import * as path from "path"
import * as vscode from "vscode"

if (vscode.workspace.workspaceFolders === undefined || vscode.workspace.workspaceFolders.length === 0) {
  throw new Error("The extension can only work with a workspace folder present.")
}

export const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath

// Variables are not resolved in settings, so we do it ourselves.
// See: https://github.com/microsoft/vscode/issues/2809
function resolveVars(value: string) {
  return value
    .replace(/\${workspaceFolder}/g, workspaceFolder)
    .replace(/\${env:([A-Z_]+)}/g, (_, name: string) => process.env[name] || "")
}

export const config = (config => ({
  uidInput: config.get<string>("uidInput")!,
  formatUid: require(resolveVars(config.get<string>("formatUidScript")!)),
  zettelsFolder: (value => (!path.isAbsolute(value) ? path.join(workspaceFolder, value) : value))(
    config.get<string>("zettelsFolder")!,
  ),
  extension: config.get<string>("extension")!,
  formatContent: require(resolveVars(config.get<string>("formatContentScript")!)),
  initCursorPattern: new RegExp(config.get<string>("initCursorPattern")!),
  formatUrl: require(resolveVars(config.get<string>("formatUrlScript")!)),
  onSave: require(resolveVars(config.get<string>("onSaveScript")!)),
}))(vscode.workspace.getConfiguration("zettel"))
