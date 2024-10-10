#import "TurboSqliteModule.h"
#import <Foundation/Foundation.h>
#import <ReactCommon/CxxTurboModuleUtils.h>

@interface TurboSqliteModuleOnLoad : NSObject
@end

@implementation TurboSqliteModuleOnLoad

+ (void)load {
  facebook::react::registerCxxModuleToGlobalModuleMap(
      std::string(facebook::react::TurboSqliteModule::kModuleName),
      [&](std::shared_ptr<facebook::react::CallInvoker> jsInvoker) {
        return std::make_shared<facebook::react::TurboSqliteModule>(jsInvoker);
      });
}

@end
