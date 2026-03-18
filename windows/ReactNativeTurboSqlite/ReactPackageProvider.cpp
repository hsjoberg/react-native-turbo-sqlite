#include "pch.h"

#include "ReactPackageProvider.h"
#if __has_include("ReactPackageProvider.g.cpp")
#include "ReactPackageProvider.g.cpp"
#endif

#include "..\..\cpp\TurboSqliteModule.h"
#include <TurboModuleProvider.h>

using namespace winrt::Microsoft::ReactNative;

namespace winrt::ReactNativeTurboSqlite::implementation
{

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
  AddTurboModuleProvider<::facebook::react::TurboSqliteModule>(packageBuilder, L"TurboSqliteCxx");
}

} // namespace winrt::ReactNativeTurboSqlite::implementation
