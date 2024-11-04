#pragma once

// Apple
#if __has_include(<React-Codegen/RNTurboSqliteSpecJSI.h>)
#include <React-Codegen/RNTurboSqliteSpecJSI.h>
// Android
#elif __has_include("RNTurboSqliteSpecJSI.h")
#include "RNTurboSqliteSpecJSI.h"
#endif

#include <string>

#include "sqlite3.h"

namespace facebook::react {

class TurboSqliteModule : public NativeTurboSqliteCxxSpec<TurboSqliteModule> {
 public:
  explicit TurboSqliteModule(std::shared_ptr<CallInvoker> jsInvoker);

  std::string getVersionString(facebook::jsi::Runtime& runtime);

  jsi::Object openDatabase(jsi::Runtime& runtime, std::string name);
};

} // namespace facebook::react
