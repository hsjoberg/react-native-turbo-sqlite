#pragma once

#include "pch.h"

#include <NativeModules.h>
#include <winrt/Windows.Storage.h>

#include <filesystem>
#include <string>

namespace winrt::ReactNativeTurboSqliteExample {

inline std::string pathToUtf8(const std::filesystem::path &path) noexcept {
  const auto widePath = path.native();
  const auto size = WideCharToMultiByte(
      CP_UTF8,
      0,
      widePath.c_str(),
      static_cast<int>(widePath.size()),
      nullptr,
      0,
      nullptr,
      nullptr);

  if (size <= 0) {
    return {};
  }

  std::string utf8Path(size, '\0');
  WideCharToMultiByte(
      CP_UTF8,
      0,
      widePath.c_str(),
      static_cast<int>(widePath.size()),
      utf8Path.data(),
      size,
      nullptr,
      nullptr);
  return utf8Path;
}

REACT_MODULE(WindowsAppPaths)
struct WindowsAppPaths {
  REACT_SYNC_METHOD(getDatabaseDirectory)
  std::string getDatabaseDirectory() noexcept {
    try {
      auto directory =
          std::filesystem::path(winrt::Windows::Storage::ApplicationData::Current().LocalFolder().Path().c_str()) /
          "test";
      std::filesystem::create_directories(directory);
      return pathToUtf8(directory);
    } catch (...) {
      auto directory = std::filesystem::temp_directory_path() / "react-native-turbo-sqlite" / "test";
      std::error_code ec;
      std::filesystem::create_directories(directory, ec);
      return pathToUtf8(directory);
    }
  }
};

} // namespace winrt::ReactNativeTurboSqliteExample
