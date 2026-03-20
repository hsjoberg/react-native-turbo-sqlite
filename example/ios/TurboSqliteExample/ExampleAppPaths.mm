#import <Foundation/Foundation.h>

#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>

#if __has_include(<ReactCodegen/TurboSqliteExampleSpec/TurboSqliteExampleSpec.h>)
#import <ReactCodegen/TurboSqliteExampleSpec/TurboSqliteExampleSpec.h>
#else
#error "Missing generated TurboSqliteExampleSpec header. Run iOS codegen/pod install and ensure ReactCodegen exposes TurboSqliteExampleSpec."
#endif

@interface ExampleAppPaths : NSObject <NativeExampleAppPathsSpec>
@end

@implementation ExampleAppPaths

RCT_EXPORT_MODULE(ExampleAppPaths)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeExampleAppPathsSpecJSI>(params);
}

RCT_EXPORT_SYNCHRONOUS_TYPED_METHOD(NSString *, getDatabaseDirectory)
{
  NSFileManager *fileManager = NSFileManager.defaultManager;
  NSString *documentsDirectory =
      NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
  NSString *primaryPath = [documentsDirectory stringByAppendingPathComponent:@"test"];

  NSError *error = nil;
  if ([fileManager createDirectoryAtPath:primaryPath withIntermediateDirectories:YES attributes:nil error:&error]) {
    return primaryPath;
  }

  NSString *fallbackPath =
      [NSTemporaryDirectory() stringByAppendingPathComponent:@"react-native-turbo-sqlite/test"];
  error = nil;
  [fileManager createDirectoryAtPath:fallbackPath withIntermediateDirectories:YES attributes:nil error:&error];
  return fallbackPath;
}

@end
