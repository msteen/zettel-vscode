import * as vscode from "vscode"
import { Zettel, ZettelTreeItem } from "../zettel"
import { Links } from "../links"

class StoryRiverTree implements vscode.TreeDataProvider<Zettel> {
  private _onDidChangeTreeData = new vscode.EventEmitter<Zettel | undefined>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  constructor(public readonly river: Zettel[]) {}

  refresh(): void {
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(zettel: Zettel): vscode.TreeItem {
    return new ZettelTreeItem("story", zettel)
  }

  async getChildren(zettel?: Zettel) {
    if (zettel === undefined) {
      return this.river
    } else {
      return []
    }
  }

  getParent() {
    return null
  }
}

class StoryRiver {
  constructor(
    public readonly river: Zettel[],
    public readonly storyRiverTree: StoryRiverTree,
    public readonly storyRiverView: vscode.TreeView<Zettel>,
  ) {
    this.storyRiverTree.onDidChangeTreeData(() => {
      if (Zettel.active) this.activate(Zettel.active)
    })
  }

  private activate(zettel: Zettel) {
    zettel.reveal(this.storyRiverView)
  }

  openLink(zettel: Zettel) {
    if (!this.river.includes(zettel)) {
      this.river.splice(this.river.indexOf(Zettel.active!) + 1, 0, zettel)
      this.storyRiverTree.refresh()
    }
  }

  open(zettel: Zettel) {
    if (!this.river.includes(zettel)) {
      this.river.unshift(zettel)
      this.storyRiverTree.refresh()
    } else {
      this.activate(zettel)
    }
  }

  close(zettel: Zettel) {
    if (this.river.includes(zettel)) {
      const index = this.river.indexOf(zettel)
      this.river.splice(index, 1)
      this.storyRiverTree.refresh()
      // Due to taking too long to trigger a close event, activating would only be problematic.
      // if (this.river.length > 0) {
      //   if (index < this.river.length) {
      //     this.activate(this.river[index])
      //   } else {
      //     this.activate(this.river[index - 1])
      //   }
      // }
    }
  }
}

export function activateStoryRiverView() {
  const river: Zettel[] = []
  const storyRiverTree = new StoryRiverTree(river)
  Zettel.onDidTreeChange(() => storyRiverTree.refresh())
  const storyRiverView = vscode.window.createTreeView("zettelStoryRiver", {
    treeDataProvider: storyRiverTree,
  })
  const storyRiver = new StoryRiver(river, storyRiverTree, storyRiverView)
  Links.onWillOpen(zettel => storyRiver.openLink(zettel))
  Zettel.onDidChangeActive(zettel => storyRiver.open(zettel))
  Zettel.onDidClose(zettel => storyRiver.close(zettel))
}
