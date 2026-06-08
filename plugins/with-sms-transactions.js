const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require("expo/config-plugins");

const RECEIVER_NAME = ".SmsReceiver";
const NOTIFICATION_LISTENER_NAME = ".BankMessageNotificationListenerService";
const SMS_ACTION = "android.provider.Telephony.SMS_RECEIVED";
const NOTIFICATION_LISTENER_ACTION =
  "android.service.notification.NotificationListenerService";

const packageToPath = (packageName) => packageName.replace(/\./g, path.sep);

const getAndroidPackage = (config) =>
  config.android?.package || AndroidConfig.Package.getPackage(config);

const smsTransactionModule = (packageName) => `package ${packageName}

import android.content.Context
import android.content.ComponentName
import android.content.Intent
import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference

class SmsTransactionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val PREFS_NAME = "sms_transaction_messages"
    const val PREFS_KEY = "pending_messages"
    const val RECENT_MESSAGES_KEY = "recent_message_fingerprints"
    const val USER_TYPE_KEY = "current_user_type"
    const val SMS_RECEIVED_EVENT = "SmsTransactionReceived"
    private const val DUPLICATE_WINDOW_MS = 2 * 60 * 1000L
    private const val TRANSACTION_CHANNEL_ID = "detected_transactions"

    private val transactionKeywordPattern =
      Regex("""(?i)\\b(debited|debit|credited|credit|spent|paid|withdrawn|purchase|sent|upi payment|received|deposited|salary|refund|cashback)\\b""")
    private val expenseKeywordPattern =
      Regex("""(?i)\\b(debited|debit|spent|paid|withdrawn|purchase|sent|upi payment)\\b""")
    private val incomeKeywordPattern =
      Regex("""(?i)\\b(credited|credit|received|deposited|salary|refund|cashback)\\b""")
    private val amountPattern =
      Regex("""(?i)(?:(?:rs\\.?|inr|\\x{20B9})\\s*[0-9][0-9,]*(?:\\.[0-9]{1,2})?|[0-9][0-9,]*(?:\\.[0-9]{1,2})?\\s*(?:rs\\.?|inr|\\x{20B9}))""")
    private val ignoredPattern =
      Regex("""(?i)\\b(otp|one[ -]time password|verification code|sale alert|buy [0-9]|offer)\\b""")

    private var activeReactContext: WeakReference<ReactApplicationContext>? = null

    fun emitSmsReceived(message: String): Boolean {
      val context = activeReactContext?.get() ?: return false

      if (!context.hasActiveReactInstance()) {
        return false
      }

      context.emitDeviceEvent(SMS_RECEIVED_EVENT, message)

      return true
    }

    @Synchronized
    fun handleIncomingMessage(context: Context, message: String) {
      val body = message.trim()

      if (body.isEmpty()) {
        return
      }

      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val now = System.currentTimeMillis()
      val fingerprint = body
        .lowercase()
        .replace("₹", "rs")
        .replace(Regex("""[^a-z0-9]+"""), "")
      val recentMessages = try {
        JSONObject(prefs.getString(RECENT_MESSAGES_KEY, "{}").orEmpty())
      } catch (_: Exception) {
        JSONObject()
      }

      val recentKeys = recentMessages.keys().asSequence().toList()
      for (key in recentKeys) {
        if (now - recentMessages.optLong(key, 0L) > DUPLICATE_WINDOW_MS) {
          recentMessages.remove(key)
        }
      }

      if (recentMessages.has(fingerprint)) {
        return
      }

      recentMessages.put(fingerprint, now)
      prefs.edit()
        .putString(RECENT_MESSAGES_KEY, recentMessages.toString())
        .commit()

      emitSmsReceived(body)

      val pendingMessages = try {
        JSONArray(prefs.getString(PREFS_KEY, "[]"))
      } catch (_: Exception) {
        JSONArray()
      }

      pendingMessages.put(body)
      prefs.edit().putString(PREFS_KEY, pendingMessages.toString()).commit()

      showTransactionNotificationIfNeeded(context, body)
    }

    private fun showTransactionNotificationIfNeeded(context: Context, body: String) {
      if (
        isAppInForeground(context) ||
        ignoredPattern.containsMatchIn(body) ||
        !transactionKeywordPattern.containsMatchIn(body) ||
        !amountPattern.containsMatchIn(body) ||
        shouldSuppressNotificationForUser(context, body)
      ) {
        return
      }

      if (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        context.checkSelfPermission("android.permission.POST_NOTIFICATIONS") !=
          PackageManager.PERMISSION_GRANTED
      ) {
        return
      }

      val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        notificationManager.createNotificationChannel(
          NotificationChannel(
            TRANSACTION_CHANNEL_ID,
            "Detected transactions",
            NotificationManager.IMPORTANCE_DEFAULT,
          ).apply {
            description = "Alerts when a bank transaction is detected"
          },
        )
      }

      val reviewIntent = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("expensetracker://pending-transactions"),
        context,
        MainActivity::class.java,
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
      val pendingIntent = PendingIntent.getActivity(
        context,
        0,
        reviewIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      val notification = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        android.app.Notification.Builder(context, TRANSACTION_CHANNEL_ID)
      } else {
        android.app.Notification.Builder(context)
      }
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle("New transaction detected")
        .setContentText("Tap to review")
        .setContentIntent(pendingIntent)
        .setAutoCancel(true)
        .setCategory(android.app.Notification.CATEGORY_STATUS)
        .build()

      notificationManager.notify(body.hashCode(), notification)
    }

    private fun shouldSuppressNotificationForUser(context: Context, body: String): Boolean {
      val userType = context
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getString(USER_TYPE_KEY, "")

      if (userType != "salary") {
        return false
      }

      return incomeKeywordPattern.containsMatchIn(body) &&
        !expenseKeywordPattern.containsMatchIn(body)
    }

    private fun isAppInForeground(context: Context): Boolean {
      val activityManager =
        context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val appProcess = activityManager.runningAppProcesses
        ?.firstOrNull { it.pid == android.os.Process.myPid() }

      return appProcess?.importance ==
        ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
    }
  }

  init {
    activeReactContext = WeakReference(reactContext)
  }

  override fun getName(): String = "SmsTransactionModule"

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun getPendingMessages(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val messages = JSONArray(prefs.getString(PREFS_KEY, "[]"))
      val result = WritableNativeArray()

      for (index in 0 until messages.length()) {
        result.pushString(messages.getString(index))
      }

      promise.resolve(result)
    } catch (error: Exception) {
      promise.reject("SMS_PENDING_READ_FAILED", error)
    }
  }

  @ReactMethod
  fun clearPendingMessages(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

      prefs.edit().remove(PREFS_KEY).apply()

      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("SMS_PENDING_CLEAR_FAILED", error)
    }
  }

  @ReactMethod
  fun isNotificationAccessEnabled(promise: Promise) {
    try {
      val componentName = ComponentName(
        reactContext,
        BankMessageNotificationListenerService::class.java,
      )
      val enabledListeners = Settings.Secure.getString(
        reactContext.contentResolver,
        "enabled_notification_listeners",
      ).orEmpty()
      val isEnabled = enabledListeners
        .split(":")
        .mapNotNull(ComponentName::unflattenFromString)
        .any { it == componentName }

      promise.resolve(isEnabled)
    } catch (error: Exception) {
      promise.reject("NOTIFICATION_ACCESS_CHECK_FAILED", error)
    }
  }

  @ReactMethod
  fun openNotificationAccessSettings(promise: Promise) {
    try {
      val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      reactContext.startActivity(intent)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("NOTIFICATION_ACCESS_SETTINGS_FAILED", error)
    }
  }

  @ReactMethod
  fun setCurrentUserType(userType: String, promise: Promise) {
    try {
      reactContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(USER_TYPE_KEY, userType)
        .apply()

      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("USER_TYPE_SYNC_FAILED", error)
    }
  }
}
`;

const smsReceiver = (packageName) => `package ${packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class SmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
      return
    }

    val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    val body = messages.joinToString(separator = "") { it.messageBody ?: "" }.trim()

    if (body.isEmpty()) {
      return
    }

    SmsTransactionModule.handleIncomingMessage(context, body)
  }
}
`;

const bankMessageNotificationListener = (packageName) => `package ${packageName}

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class BankMessageNotificationListenerService : NotificationListenerService() {
  companion object {
    private const val GOOGLE_MESSAGES_PACKAGE = "com.google.android.apps.messaging"

    private val transactionKeywordPattern =
      Regex("""(?i)\\b(debited|debit|credited|credit|spent|paid|withdrawn|purchase|received|deposited|refund|cashback)\\b""")
    private val amountPattern =
      Regex("""(?i)(?:(?:rs\\.?|inr|\\x{20B9})\\s*[0-9][0-9,]*(?:\\.[0-9]{1,2})?|[0-9][0-9,]*(?:\\.[0-9]{1,2})?\\s*(?:rs\\.?|inr|\\x{20B9}))""")
    private val ignoredPattern =
      Regex("""(?i)\\b(otp|one[ -]time password|verification code|sale alert|buy [0-9]|offer)\\b""")
  }

  override fun onNotificationPosted(statusBarNotification: StatusBarNotification?) {
    val notification = statusBarNotification?.notification ?: return

    if (statusBarNotification.packageName != GOOGLE_MESSAGES_PACKAGE) {
      return
    }

    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) {
      return
    }

    val extras = notification.extras
    val body = (
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
        ?: extras.getCharSequence(Notification.EXTRA_TEXT)
        ?: extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString(" ")
      )
      ?.toString()
      ?.replace(Regex("""\\s+"""), " ")
      ?.trim()
      .orEmpty()

    if (
      body.isEmpty() ||
      ignoredPattern.containsMatchIn(body) ||
      !transactionKeywordPattern.containsMatchIn(body) ||
      !amountPattern.containsMatchIn(body)
    ) {
      return
    }

    SmsTransactionModule.handleIncomingMessage(applicationContext, body)
  }
}
`;

const smsTransactionPackage = (packageName) => `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SmsTransactionPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(SmsTransactionModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
`;

const writeKotlinFiles = (projectRoot, packageName) => {
  const sourceDir = path.join(
    projectRoot,
    "android",
    "app",
    "src",
    "main",
    "java",
    packageToPath(packageName),
  );

  fs.mkdirSync(sourceDir, { recursive: true });

  fs.writeFileSync(
    path.join(sourceDir, "SmsTransactionModule.kt"),
    smsTransactionModule(packageName),
  );
  fs.writeFileSync(path.join(sourceDir, "SmsReceiver.kt"), smsReceiver(packageName));
  fs.writeFileSync(
    path.join(sourceDir, "BankMessageNotificationListenerService.kt"),
    bankMessageNotificationListener(packageName),
  );
  fs.writeFileSync(
    path.join(sourceDir, "SmsTransactionPackage.kt"),
    smsTransactionPackage(packageName),
  );
};

const withSmsReceiverManifest = (config) =>
  withAndroidManifest(config, (pluginConfig) => {
    const manifest = pluginConfig.modResults.manifest;
    const application = manifest.application?.[0];

    if (!application) {
      return pluginConfig;
    }

    const receivers = application.receiver || [];
    const existingReceiver = receivers.find(
      (receiver) => receiver.$["android:name"] === RECEIVER_NAME,
    );

    const receiver = existingReceiver || {
      $: {
        "android:name": RECEIVER_NAME,
        "android:exported": "true",
      },
    };

    receiver["intent-filter"] = [
      {
        action: [{ $: { "android:name": SMS_ACTION } }],
      },
    ];

    if (!existingReceiver) {
      receivers.push(receiver);
      application.receiver = receivers;
    }

    const services = application.service || [];
    const existingService = services.find(
      (service) =>
        service.$["android:name"] === NOTIFICATION_LISTENER_NAME,
    );
    const notificationListener = existingService || {
      $: {
        "android:name": NOTIFICATION_LISTENER_NAME,
        "android:exported": "true",
        "android:label": "Bank message detection",
        "android:permission":
          "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
      },
    };

    notificationListener["intent-filter"] = [
      {
        action: [{ $: { "android:name": NOTIFICATION_LISTENER_ACTION } }],
      },
    ];

    if (!existingService) {
      services.push(notificationListener);
      application.service = services;
    }

    return pluginConfig;
  });

const withSmsMainApplicationPackage = (config) =>
  withMainApplication(config, (pluginConfig) => {
    let contents = pluginConfig.modResults.contents;

    if (!contents.includes("add(SmsTransactionPackage())")) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        (match) => `${match}\n              add(SmsTransactionPackage())`,
      );
    }

    pluginConfig.modResults.contents = contents;

    return pluginConfig;
  });

const withSmsKotlinFiles = (config) =>
  withDangerousMod(config, [
    "android",
    async (pluginConfig) => {
      writeKotlinFiles(
        pluginConfig.modRequest.projectRoot,
        getAndroidPackage(pluginConfig),
      );

      return pluginConfig;
    },
  ]);

const withSmsTransactions = (config) => {
  config = withSmsReceiverManifest(config);
  config = withSmsMainApplicationPackage(config);
  config = withSmsKotlinFiles(config);

  return config;
};

module.exports = withSmsTransactions;
