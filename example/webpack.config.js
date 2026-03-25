const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const root = __dirname;
const repoRoot = path.resolve(__dirname, "..");

module.exports = {
  entry: path.join(root, "index.web.js"),
  output: {
    clean: true,
    filename: "bundle.js",
    path: path.join(root, "dist-webpack"),
    publicPath: "/",
  },
  resolve: {
    alias: {
      "react-native$": "react-native-web",
    },
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
      ".json",
    ],
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        include: [root, path.join(repoRoot, "src")],
        use: {
          loader: "babel-loader",
          options: {
            configFile: path.join(root, "babel.config.js"),
          },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(root, "index.webpack.html"),
    }),
  ],
  devtool: "source-map",
  devServer: {
    static: {
      directory: root,
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    historyApiFallback: true,
    hot: false,
  },
};
