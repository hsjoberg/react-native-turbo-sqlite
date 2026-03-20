package com.turbosqliteexample

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.turbosqliteexample.specs.NativeExampleAppPathsSpec

class ExampleAppPathsPackage : BaseReactPackage() {
  override fun getModule(
      name: String,
      reactContext: ReactApplicationContext,
  ): NativeModule? =
      when (name) {
        NativeExampleAppPathsSpec.NAME -> ExampleAppPathsModule(reactContext)
        else -> null
      }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        NativeExampleAppPathsSpec.NAME to
            ReactModuleInfo(
                NativeExampleAppPathsSpec.NAME,
                ExampleAppPathsModule::class.java.name,
                false,
                false,
                false,
                true,
            )
    )
  }
}
