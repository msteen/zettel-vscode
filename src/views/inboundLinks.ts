import * as vscode from "vscode"
import { Zettel, ZettelTreeItem } from "../zettel"

class InboundLinksTree implements vscode.TreeDataProvider<Zettel> {
  private _onDidChangeTreeData = new vscode.EventEmitter<Zettel | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(zettel: Zettel): vscode.TreeItem {
    return new ZettelTreeItem("inboundLink", zettel)
  }

  async getChildren(zettel?: Zettel) {
    if (zettel === undefined && Zettel.active !== undefined) {
      return Array.from(Zettel.active.inbound)
    } else {
      return []
    }
  }
}

export function activateInboundLinksView() {
  const inboundLinkTree = new InboundLinksTree()
  vscode.window.registerTreeDataProvider("zettelInboundLinks", inboundLinkTree)
  Zettel.onDidChangeActive(() => inboundLinkTree.refresh())
}
