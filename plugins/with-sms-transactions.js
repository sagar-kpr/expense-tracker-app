const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require("expo/config-plugins");

const RECEIVER_NAME = ".SmsReceiver";
const SMS_ACTION = "android.provider.Telephony.SMS_RECEIVED";

const packageToPath = (packageName) => packageName.replace(/\./g, path.sep);

const getAndroidPackage = (config) =>
  config.android?.package || AndroidConfig.Package.getPackage(config);

const smsTransactionModule = (packageName) => `package ${packageName}

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import org.json.JSONArray
import java.lang.ref.WeakReference

class SmsTransactionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    const val PREFS_NAME = "sms_transaction_messages"
    const val PREFS_KEY = "pending_messages"
    const val SMS_RECEIVED_EVENT = "SmsTransactionReceived"

    private var activeReactContext: WeakReference<ReactApplicationContext>? = null

    fun emitSmsReceived(message: String): Boolean {
      val context = activeReactContext?.get() ?: return false

      if (!context.hasActiveReactInstance()) {
        return false
      }

      context.emitDeviceEvent(SMS_RECEIVED_EVENT, message)

      return true
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
}
`;

const smsReceiver = (packageName) => `package ${packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import org.json.JSONArray

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

    SmsTransactionModule.emitSmsReceived(body)

    val prefs = context.getSharedPreferences(SmsTransactionModule.PREFS_NAME, Context.MODE_PRIVATE)
    val existing = prefs.getString(SmsTransactionModule.PREFS_KEY, "[]")
    val pendingMessages = try {
      JSONArray(existing)
    } catch (_: Exception) {
      JSONArray()
    }

    pendingMessages.put(body)

    prefs.edit().putString(SmsTransactionModule.PREFS_KEY, pendingMessages.toString()).commit()
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
