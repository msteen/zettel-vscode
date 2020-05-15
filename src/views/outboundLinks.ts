import * as vscode from "vscode"
import { Zettel, ZettelTreeItem } from "../zettel"

class OutboundLink extends vscode.TreeItem {
  constructor(public readonly zettel: Zettel, public readonly depth: number) {
    super(
      zettel.fileUri,
      zettel.outbound.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None,
    )
    this.label = zettel.label
    if (zettel.label !== zettel.uid) this.description = zettel.uid
    this.tooltip = zettel.createdDateTime
  }

  contextValue = "outboundLink"

  command = {
    title: "Show",
    command: "zettel.show",
    arguments: [this.zettel],
  }
}

class OutboundLinksTree implements vscode.TreeDataProvider<OutboundLink> {
  private _onDidChangeTreeData = new vscode.EventEmitter<OutboundLink | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  public activeZettel: Zettel | undefined
  private rootZettels: Zettel[] = []

  constructor() {
    this.setActive(undefined)
  }

  setActive(zettel?: Zettel) {
    this.activeZettel = zettel
    let parents = [zettel]
    for (let i = 0; i < 3; i++) {
      parents = parents.flatMap(zettel => (zettel ? Array.from(zettel.inbound) : undefined))
    }
    const reachedRoot = parents.length === 0 || parents.includes(undefined)
    let roots = parents.filter(zettel => zettel) as Zettel[]
    if (reachedRoot) roots = Zettel.zettels.filter(zettel => zettel.inbound.size === 0).concat(roots)
    inspect(
      "roots",
      roots.map(zettel => (zettel ? zettel.uid + " " + zettel.title : undefined)),
    )
    this.rootZettels = roots
  }

  updateActive(zettel?: Zettel) {
    this.setActive(zettel)
    this.refresh()
  }

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(link: OutboundLink): vscode.TreeItem {
    return link
  }

  async getChildren(link?: OutboundLink) {
    const depth = link ? link.depth + 1 : 0
    return (!link ? this.rootZettels : depth < 6 ? link.zettel.outbound : []).map(
      zettel => new OutboundLink(zettel, depth),
    )
  }
}

export function activateOutboundLinksView() {
  const outboundLinksTree = new OutboundLinksTree()
  Zettel.onDidTreeChange(() => outboundLinksTree.updateActive(outboundLinksTree.activeZettel))
  const outboundLinksView = vscode.window.createTreeView("zettelOutboundLinks", {
    treeDataProvider: outboundLinksTree,
  })
  Zettel.onDidChangeActive(zettel => outboundLinksTree.updateActive(zettel))
}
