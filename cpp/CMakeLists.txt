cmake_minimum_required(VERSION 3.13)

project(TurboSqlite)

set(CMAKE_VERBOSE_MAKEFILE on)
set(CMAKE_CXX_STANDARD 20)

# Check for SQLCipher configuration
execute_process(
    COMMAND node "${CMAKE_CURRENT_SOURCE_DIR}/../scripts/check-sqlcipher-config.js"
    OUTPUT_VARIABLE USE_SQLCIPHER_OUTPUT
    OUTPUT_STRIP_TRAILING_WHITESPACE
    RESULT_VARIABLE CHECK_CONFIG_RESULT
)

if(CHECK_CONFIG_RESULT EQUAL 0 AND USE_SQLCIPHER_OUTPUT STREQUAL "1")
    set(USE_SQLCIPHER ON)
    message(STATUS "[react-native-turbo-sqlite] Building with SQLCipher support enabled")
else()
    set(USE_SQLCIPHER OFF)
    message(STATUS "[react-native-turbo-sqlite] Building with standard SQLite (no encryption)")
endif()

# Separate C and C++ files
if(USE_SQLCIPHER)
    # Use SQLCipher amalgamation
    file(GLOB c_source_files CONFIGURE_DEPENDS sqlcipher/*.c)
    file(GLOB cpp_source_files CONFIGURE_DEPENDS *.cpp)
else()
    # Use standard SQLite
    file(GLOB c_source_files CONFIGURE_DEPENDS sqlite3.c)
    file(GLOB cpp_source_files CONFIGURE_DEPENDS *.cpp)
endif()

# Build a static library from the source files
add_library(TurboSqlite STATIC ${c_source_files} ${cpp_source_files})

# Add headers search paths
if(USE_SQLCIPHER)
    target_include_directories(TurboSqlite PUBLIC . sqlcipher)
else()
    target_include_directories(TurboSqlite PUBLIC .)
endif()

# Set C++ specific compile options
set(CXX_COMPILE_OPTIONS -fexceptions -frtti -std=c++20)

# Apply C++ compile options only to C++ files
target_compile_options(TurboSqlite PRIVATE
    $<$<COMPILE_LANGUAGE:CXX>:${CXX_COMPILE_OPTIONS}>
)

# SQLCipher specific configuration
if(USE_SQLCIPHER)
    # Add SQLCipher compile definitions
    target_compile_definitions(TurboSqlite PRIVATE
        SQLITE_HAS_CODEC
        SQLITE_TEMP_STORE=2
        SQLITE_EXTRA_INIT=sqlcipher_extra_init
        SQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown
    )

    # Find and link OpenSSL (required for Android, not needed for iOS/macOS which use CommonCrypto)
    if(ANDROID)
        # Use Prefab to find OpenSSL package
        find_package(openssl REQUIRED CONFIG)
        target_link_libraries(TurboSqlite openssl::crypto)
        message(STATUS "[react-native-turbo-sqlite] Linked against OpenSSL via Prefab")
    else()
        # iOS/macOS use CommonCrypto via Security.framework (configured in podspec)
        message(STATUS "[react-native-turbo-sqlite] Using CommonCrypto (iOS/macOS)")
    endif()
endif()

# Finally link the library with the codegen specs
target_link_libraries(TurboSqlite react_codegen_RNTurboSqliteSpec)