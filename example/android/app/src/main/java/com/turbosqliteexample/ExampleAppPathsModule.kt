package com.turbosqliteexample

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.turbosqliteexample.specs.NativeExampleAppPathsSpec
import java.io.File

@ReactModule(name = NativeExampleAppPathsSpec.NAME)
class ExampleAppPathsModule(reactContext: ReactApplicationContext) :
    NativeExampleAppPathsSpec(reactContext) {

  override fun getDatabaseDirectory(): String {
    val primaryDirectory = File(reactApplicationContext.filesDir, "test")
    if (ensureDirectory(primaryDirectory)) {
      return primaryDirectory.absolutePath
    }

    val fallbackDirectory =
        File(reactApplicationContext.cacheDir, "react-native-turbo-sqlite/test")
    if (ensureDirectory(fallbackDirectory)) {
      return fallbackDirectory.absolutePath
    }

    throw IllegalStateException("Unable to create database directory")
  }

  private fun ensureDirectory(directory: File): Boolean {
    return directory.isDirectory || directory.mkdirs()
  }
}
