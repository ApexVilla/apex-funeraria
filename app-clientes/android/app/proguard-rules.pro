# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Preserve line numbers and source file names for crash symbolication
-keepattributes SourceFile,LineNumberTable,Signature,InnerClasses,EnclosingMethod

# Capacitor core and plugin interfaces
-keep class com.getcapacitor.** { *; }
-keepclasseswithmembers class * {
  @com.getcapacitor.PluginMethod public void *(com.getcapacitor.PluginCall);
}

# Preserve webview JS interfaces
-keepclassmembers class * {
  @android.webkit.JavascriptInterface <methods>;
}
