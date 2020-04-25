import * as moment from "moment"
import * as vscode from "vscode"

export = function onSave(document: vscode.TextDocument) {
  const match = document.getText().match(/Modified: .*/)
  if (match === null) return []
  const range = new vscode.Range(
    document.positionAt(match.index!),
    document.positionAt(match.index! + match[0].length),
  )
  return [vscode.TextEdit.replace(range, `Modified: ${moment().toISOString(true)}`)]
}
