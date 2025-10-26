require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -Wno-comma -Wno-shorten-64-to-32'

# Check for SQLCipher configuration
# Search up directory tree for package.json with react-native-turbo-sqlite config (for monorepo support)
def find_config(dir)
  return nil if dir == '/' || dir == '.'
  package_json_path = File.join(dir, 'package.json')
  if File.exist?(package_json_path)
    app_package = JSON.parse(File.read(package_json_path))
    config = app_package.dig('react-native-turbo-sqlite', 'sqlcipher')
    return config unless config.nil?
  end
  find_config(File.dirname(dir))
end

use_sqlcipher = find_config(File.dirname(__dir__)) || false

Pod::Spec.new do |s|

  s.name         = "react-native-turbo-sqlite"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported, :osx => "11.0" }
  s.source       = { :git => "https://github.com/hsjoberg/react-native-turbo-sqlite.git", :tag => "#{s.version}" }

  if use_sqlcipher
    # SQLCipher build: use sqlcipher amalgamation
    s.source_files = ["cpp/**/*.{h,hpp,cpp}", "cpp/sqlcipher/*.{c,h}", "ios/OnLoad.mm"]
    s.exclude_files = ["cpp/build", "cpp/sqlite3.c", "cpp/sqlite3.h"]

    # SQLCipher compiler flags
    s.compiler_flags = '-DSQLITE_HAS_CODEC', '-DSQLITE_TEMP_STORE=2', '-DSQLITE_EXTRA_INIT=sqlcipher_extra_init', '-DSQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown'

    # Link Security framework for CommonCrypto on iOS/macOS
    s.frameworks = 'Security'

    puts "[react-native-turbo-sqlite] Building with SQLCipher support enabled"
  else
    # Standard SQLite build
    s.source_files = ["cpp/**/*.{h,hpp,cpp,c}", "ios/OnLoad.mm"]
    s.exclude_files = ["cpp/build", "cpp/sqlcipher"]

    puts "[react-native-turbo-sqlite] Building with standard SQLite (no encryption)"
  end

  # Use install_modules_dependencies helper to install the dependencies if React Native version >=0.71.0.
  # See https://github.com/facebook/react-native/blob/febf6b7f33fdb4904669f99d795eba4c0f95d7bf/scripts/cocoapods/new_architecture.rb#L79.
  install_modules_dependencies(s)
end
