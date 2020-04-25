import * as vscode from "vscode"
import { Zettel, ZettelTreeItem } from "../zettel"

function isErrorZettel(zettel: Zettel) {
  return zettel.warnings.length > 0
}

class ErrorTree implements vscode.TreeDataProvider<Zettel> {
  private _onDidChangeTreeData = new vscode.EventEmitter<Zettel | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(zettel: Zettel) {
    return new ZettelTreeItem("error", zettel)
  }

  getChildren(zettel?: Zettel) {
    if (zettel === undefined) {
      return Zettel.zettels.filter(isErrorZettel)
    } else {
      return []
    }
  }

  getParent() {
    return null
  }
}

export function activateWarningsView() {
  const errorTree = new ErrorTree()
  Zettel.onDidTreeChange(() => errorTree.refresh())
  const warningsView = vscode.window.createTreeView("zettelWarnings", {
    treeDataProvider: errorTree,
  })
  Zettel.onDidChangeActive(zettel => {
    if (isErrorZettel(zettel)) {
      zettel.reveal(warningsView)
      for (const error of zettel.warnings) {
        vscode.window.showErrorMessage(error)
      }
    }
  })
}
