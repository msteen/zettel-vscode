import * as fs from "fs"
import * as path from "path"
import * as vscode from "vscode"
import * as moment from "moment"
import { config } from "./config"
import { setEditorPosition, positionAtInitCursorPattern } from "./utils"

function fireZettel(eventEmitter: vscode.EventEmitter<Zettel>) {
  return (fileUri: vscode.Uri) => {
    const zettel = Zettel.from(fileUri)
    if (zettel !== null) eventEmitter.fire(zettel)
  }
}

export class Zettel {
  static lookup: { [uid: string]: Zettel } = {}

  private static zettelsWatcher = vscode.workspace.createFileSystemWatcher(
    path.join(config.zettelsFolder, `*${config.extension}`),
  )

  private static _onDidChange = (() => {
    const eventEmitter = new vscode.EventEmitter<Zettel>()
    Zettel.zettelsWatcher.onDidChange(fireZettel(eventEmitter))
    return eventEmitter
  })()
  static readonly onDidChange = Zettel._onDidChange.event

  private static _onDidCreate = (() => {
    const eventEmitter = new vscode.EventEmitter<Zettel>()
    Zettel.zettelsWatcher.onDidCreate(fireZettel(eventEmitter))
    return eventEmitter
  })()
  static readonly onDidCreate = Zettel._onDidCreate.event

  private static _onDidDelete = (() => {
    const eventEmitter = new vscode.EventEmitter<Zettel>()
    Zettel.zettelsWatcher.onDidDelete(fireZettel(eventEmitter))
    return eventEmitter
  })()
  static readonly onDidDelete = Zettel._onDidDelete.event

  private static _onDidTreeChange = (() => {
    const eventEmitter = new vscode.EventEmitter<Zettel>()
    Zettel.onDidChange(zettel => eventEmitter.fire(zettel))
    Zettel.onDidCreate(zettel => eventEmitter.fire(zettel))
    Zettel.onDidDelete(zettel => eventEmitter.fire(zettel))
    return eventEmitter
  })()
  static readonly onDidTreeChange = Zettel._onDidTreeChange.event

  static active: Zettel | undefined

  private static _onDidChangeActive = (() => {
    const eventEmitter = new vscode.EventEmitter<Zettel>()
    vscode.window.onDidChangeActiveTextEditor(editor => {
      const zettel = Zettel.from(editor?.document.uri)
      if (zettel === null) return
      eventEmitter.fire(zettel)
    })
    return eventEmitter
  })()
  static readonly onDidChangeActive = Zettel._onDidChangeActive.event

  static activate(zettel: Zettel) {
    Zettel._onDidChangeActive.fire(zettel)
  }

  private static _onDidOpen = (() => {
    const eventEmitter = new vscode.EventEmitter<Zettel>()
    vscode.workspace.onDidOpenTextDocument(document => {
      const zettel = Zettel.from(document?.uri)
      if (zettel === null) return
      eventEmitter.fire(zettel)
    })
    return eventEmitter
  })()
  static readonly onDidOpen = Zettel._onDidOpen.event

  private static _onDidClose = (() => {
    const eventEmitter = new vscode.EventEmitter<Zettel>()
    // It works, it just takes a long time to trigger.
    // See: https://github.com/Microsoft/vscode/issues/70439
    vscode.workspace.onDidCloseTextDocument(document => {
      const zettel = Zettel.from(document?.uri)
      if (zettel === null) return
      eventEmitter.fire(zettel)
    })
    return eventEmitter
  })()
  static readonly onDidClose = Zettel._onDidClose.event

  static async reload() {
    Zettel.lookup = {}
    const zettels = (await vscode.workspace.fs.readDirectory(vscode.Uri.file(config.zettelsFolder)))
      .filter(entry => entry[1] === vscode.FileType.File && entry[0].endsWith(config.extension))
      .map(entry => Zettel.create(path.basename(entry[0], config.extension)))
    for (const zettel of zettels) {
      zettel.processContent()
    }
    for (const zettel of zettels) {
      zettel.checkWarnings()
    }
  }

  static create(uid: string, created?: moment.Moment) {
    if (uid in Zettel.lookup) {
      throw new Error(`Zettel with unique identifier '${uid}' already exists.`)
    }
    const zettel = new Zettel(uid, created)
    Zettel.lookup[uid] = zettel
    return zettel
  }

  static from(uid: string | vscode.Uri | null | undefined) {
    if (uid instanceof vscode.Uri) uid = path.basename(uid.fsPath, config.extension)
    if (typeof uid !== "string") return null
    if (!(uid in Zettel.lookup)) {
      const zettel = new Zettel(uid)
      if (fs.existsSync(zettel.file)) {
        Zettel.lookup[uid] = zettel
        zettel.processContent()
      } else {
        return null
      }
    }
    return Zettel.lookup[uid]
  }

  static get uids() {
    return Object.keys(Zettel.lookup)
  }

  static get zettels() {
    return Object.values(Zettel.lookup)
  }

  file: string
  fileUri: vscode.Uri
  label: string
  get createdDateTime() {
    return this.created?.format("YYYY-MM-DD HH:mm:ss")
  }
  outbound: Zettel[] = []
  inbound: Set<Zettel> = new Set()
  deadlinks: string[] = []
  warnings: string[] = []
  title: string | undefined
  truncation: string | undefined

  private constructor(public readonly uid: string, public created?: moment.Moment) {
    this.file = path.join(config.zettelsFolder, `${uid}${config.extension}`)
    this.fileUri = vscode.Uri.file(this.file)
    this.label = uid
  }

  processContent() {
    const content = fs.readFileSync(this.file, "utf8")
    const createdMatch = content.match(/created: ([0-9-T:\.+]+)/i)
    if (createdMatch !== null) {
      const timestamp = moment(createdMatch[1], moment.ISO_8601, true)
      if (timestamp !== null && timestamp.isValid()) {
        this.created = timestamp
      }
    }
    const titleMatch = content.match(/(?:^|\n)# (.+)(?:\n|$)/)
    if (titleMatch !== null) {
      this.title = titleMatch[1]
    }
    config.initCursorPattern.lastIndex = 0
    const truncationMatch = content.match(config.initCursorPattern)
    if (truncationMatch !== null) {
      const truncation = content
        .substr(truncationMatch.index! + truncationMatch[0].length, 20)
        .replace(/\n/g, " ")
      if (truncation.trim() !== "") {
        this.truncation = truncation + "..."
      }
    }
    for (const zettel of this.outbound) zettel.inbound.delete(this)
    this.deadlinks = []
    this.outbound = []
    for (const match of content.matchAll(/\[\[([^\]]*)\]\]/g)) {
      const text = match[1]
      const zettel = Zettel.from(text)
      if (zettel !== null) {
        this.outbound.push(zettel)
      } else {
        this.deadlinks.push(text)
      }
    }
    for (const zettel of this.outbound) zettel.inbound.add(this)
    this.label = this.title || this.truncation || this.createdDateTime || this.uid
  }

  checkWarnings() {
    this.warnings = []
    if (this.outbound.length === 0 && this.inbound.size === 0) {
      this.warnings.push(`Unconnected: Zettel '${this.label}' has no connection to any other Zettel.`)
    }
    // if (this.deadlinks.length > 0) {
    //   this.warnings.push(`Deadlinks: Zettel '${this.label}' contains links towards non-existing Zettels.`)
    // }
  }

  updateContent() {
    this.processContent()
    this.checkWarnings()
  }

  show() {
    return vscode.workspace.openTextDocument(this.fileUri).then(document => {
      vscode.window
        .showTextDocument(document, {
          preview: false,
        })
        .then(() => {
          const editor = vscode.window.activeTextEditor!
          if (editor.selection.start.isEqual(new vscode.Position(0, 0))) {
            setEditorPosition(positionAtInitCursorPattern(document), editor)
          }
        })
    })
  }

  reveal(treeView: vscode.TreeView<Zettel>) {
    setTimeout(() => treeView.reveal(this), 100)
  }
}

export class ZettelTreeItem extends vscode.TreeItem {
  constructor(public readonly contextValue: string, public readonly zettel: Zettel) {
    super(zettel.fileUri, vscode.TreeItemCollapsibleState.None)
    this.label = zettel.label
    this.id = zettel.uid
    if (zettel.label !== zettel.uid) this.description = zettel.uid
    this.tooltip = zettel.createdDateTime
  }

  command = {
    title: "Show",
    command: "zettel.show",
    arguments: [this.zettel],
  }
}

Zettel.onDidChange(zettel => zettel.updateContent())
Zettel.onDidChangeActive(zettel => (Zettel.active = zettel))
