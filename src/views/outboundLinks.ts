import * as vscode from "vscode"
import { Zettel, ZettelTreeItem } from "../zettel"

class OutboundLinksTree implements vscode.TreeDataProvider<Zettel> {
  private _onDidChangeTreeData = new vscode.EventEmitter<Zettel | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(zettel: Zettel): vscode.TreeItem {
    const treeItem = new ZettelTreeItem("outboundLink", zettel)
    treeItem.collapsibleState =
      zettel.outbound.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    return treeItem
  }

  async getChildren(zettel?: Zettel) {
    if (zettel === undefined) {
      return Zettel.zettels.filter(zettel => zettel.inbound.size === 0)
    } else {
      return zettel.outbound
    }
  }
}

export function activateOutboundLinksView() {
  const outboundLinksTree = new OutboundLinksTree()
  Zettel.onDidTreeChange(() => outboundLinksTree.refresh())
  const outboundLinksView = vscode.window.createTreeView("zettelOutboundLinks", {
    treeDataProvider: outboundLinksTree,
  })
  // Zettel.onDidChangeActive(zettel => zettel.reveal(outboundLinksView))
}
