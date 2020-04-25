import * as moment from "moment"
import * as vscode from "vscode"
import { config } from "./config"

export function setEditorPosition(
  position: vscode.Position,
  editor: vscode.TextEditor = vscode.window.activeTextEditor!,
) {
  editor.selection = new vscode.Selection(position, position)
}

export function positionAtInitCursorPattern(document: vscode.TextDocument): vscode.Position {
  config.initCursorPattern.lastIndex = 0
  const match = document.getText().match(config.initCursorPattern)
  return match !== null ? document.positionAt(match.index! + match[0].length) : new vscode.Position(0, 0)
}

function nextCount(context: vscode.ExtensionContext) {
  const count = context.globalState.get<number>("count") || 0
  context.globalState.update("count", count + 1)
  return count
}

let lastTimestamp = 0
function nextTimestamp() {
  let timestamp = Date.now()
  if (timestamp === lastTimestamp) timestamp++
  lastTimestamp = timestamp
  return timestamp
}

export function nextUidInput(context: vscode.ExtensionContext) {
  return config.uidInput === "count" ? nextCount(context) : moment(nextTimestamp())
}

export function getLinkedUid(document: vscode.TextDocument, position: vscode.Position): string | null {
  const range = document.getWordRangeAtPosition(position, /\[\[[^\]]*\]\]/)
  if (range === undefined) return null
  return document.getText(range).replace(/\[\[([^\]]*)\]\]/, "$1")
}
