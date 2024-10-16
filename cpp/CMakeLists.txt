cmake_minimum_required(VERSION 3.13)

project(TurboSqlite)

set(CMAKE_VERBOSE_MAKEFILE on)
set(CMAKE_CXX_STANDARD 20)

# Separate C and C++ files
file(GLOB c_source_files CONFIGURE_DEPENDS *.c)
file(GLOB cpp_source_files CONFIGURE_DEPENDS *.cpp)

# Add SQLite compilation flags
# add_compile_definitions(SQLITE_ENABLE_RTREE SQLITE_ENABLE_FTS4 SQLITE_ENABLE_FTS5 SQLITE_ENABLE_JSON1 SQLITE_ENABLE_RBU SQLITE_ENABLE_SESSION)

# Build a static library from the source files
add_library(TurboSqlite STATIC ${c_source_files} ${cpp_source_files})

# Add headers search paths
target_include_directories(TurboSqlite PUBLIC .)

# Set C++ specific compile options
set(CXX_COMPILE_OPTIONS -fexceptions -frtti -std=c++20)

# Apply C++ compile options only to C++ files
target_compile_options(TurboSqlite PRIVATE
    $<$<COMPILE_LANGUAGE:CXX>:${CXX_COMPILE_OPTIONS}>
)

# Finally link the library with the codegen specs
target_link_libraries(TurboSqlite react_codegen_RNTurboSqliteSpec)