// https://github.com/monferrand/mzettel
// https://github.com/kortina/vscode-markdown-notes
// https://github.com/nergal-perm/zettelkasten-vscode
// https://gitlab.com/memorize_it/memorize/-/tree/master

// TODO: Add a graph view: https://www.youtube.com/watch?v=a6yUA46ek6M
// See: https://js.cytoscape.org/
// TODO: Look at this: http://tiddlymap.org/

import * as fs from "fs"
import * as path from "path"
import * as vscode from "vscode"
import * as moment from "moment"

const config = vscode.workspace.getConfiguration("zettel")
const uidInput = config.get<string>("uidInput")!
const formatUid = require(config.get<string>("formatUidScript")!)
// Environment variables are not resolved in settings, so we do it ourselves.
// See: https://github.com/microsoft/vscode/issues/2809
const dataDir = config
  .get<string>("dataDir")!
  .replace(/\${env:([A-Z_]+)}/g, (_, name: string) => process.env[name] || "")
const extension = config.get<string>("extension")!
const formatContent = require(config.get<string>("formatContentScript")!)
const cursorPattern = new RegExp(config.get<string>("cursorPattern")!)
const formatUrl = require(config.get<string>("formatUrlScript")!)
const onSave = require(config.get<string>("onSaveScript")!)

const zettelsDir = path.join(dataDir, "zettels")

function setEditorPosition(position: vscode.Position) {
  const editor = vscode.window.activeTextEditor!
  const newSelection = new vscode.Selection(position, position)
  editor.selection = newSelection
}

function positionAfterSeperator(document: vscode.TextDocument): vscode.Position {
  cursorPattern.lastIndex = 0
  const match = document.getText().match(cursorPattern)
  return match !== null ? document.positionAt(match.index! + match[0].length) : new vscode.Position(0, 0)
}

function uidToFile(uid: string) {
  return path.join(dataDir, "zettels", `${uid}${extension}`)
}

function uidToFileUri(uid: string) {
  return vscode.Uri.file(uidToFile(uid))
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

function nextUidInput(context: vscode.ExtensionContext) {
  return uidInput === "count" ? nextCount(context) : nextTimestamp()
}

async function newUid(context: vscode.ExtensionContext) {
  vscode.env.clipboard.writeText(formatUid(nextUidInput(context)))
}

function parseCount(text: string) {
  const count = Number(text)
  return Number.isSafeInteger(count) ? count : null
}

async function parseTimestamp(text: string) {
  let timestamp = moment(text, [moment.ISO_8601, moment.RFC_2822], true)
  if (!timestamp.isValid()) {
    const format = await vscode.window.showInputBox({
      prompt: `What date time format has text '${text}'?`,
    })
    if (!format) return null
    const newText = await vscode.window.showInputBox({
      prompt: `Does the text need tweaking?`,
      value: text,
    })
    if (!newText) return null
    timestamp = moment(newText, format, true)
  }
  return timestamp.isValid() ? timestamp.valueOf() : null
}

async function parseClipboardTextToUid() {
  const text = await vscode.env.clipboard.readText()
  const input = uidInput === "timestamp" ? await parseTimestamp(text) : parseCount(text)
  if (input !== null) {
    vscode.env.clipboard.writeText(formatUid(input))
  } else {
    vscode.window.showErrorMessage(`Could not parse clipboard text '${text}' to a ${uidInput}.`)
  }
}

function showZettelDocument(file: string) {
  return vscode.workspace.openTextDocument(file).then(document => {
    vscode.window
      .showTextDocument(document, {
        preserveFocus: false,
        preview: false,
      })
      .then(() => setEditorPosition(positionAfterSeperator(document)))
  })
}

async function newZettel(context: vscode.ExtensionContext) {
  const input = nextUidInput(context)
  const uid = formatUid(input)
  const file = uidToFile(uid)
  const content = formatContent(uid, input)
  try {
    await fs.promises.writeFile(file, content, { flag: "wx" })
  } catch (e) {
    await vscode.window.showErrorMessage(`File '${file}' could not be created.`)
  }
  await showZettelDocument(file)
}

async function showZettel(uid: string) {
  await showZettelDocument(uidToFile(uid))
}

function showZettelError(uid: string) {
  // TODO: Present the error.
  // Unconnected
  // Deadlinks
  return showZettel(uid)
}

async function openZettel() {
  const uid = await vscode.window.showQuickPick(listUids())
  if (uid === undefined) return
  await showZettel(uid)
}

function getActiveUid() {
  const editor = vscode.window.activeTextEditor!
  return path.basename(editor.document.fileName, extension)
}

async function uidToClipboard() {
  vscode.env.clipboard.writeText(getActiveUid())
}

async function urlToClipboard() {
  vscode.env.clipboard.writeText(formatUrl(getActiveUid()))
}

async function linkToClipboard() {
  // TODO: Get the title, truncation, or moment to represent the zettel in one line.
  // vscode.env.clipboard.writeText(`[](zettel://${getActiveUid()})`)
  vscode.env.clipboard.writeText(`[[${getActiveUid()}]]`)
}

async function refreshIndex() {
  // TODO: Update the graph index.
  vscode.window.showInformationMessage("refresh")
}

function getLinkedUid(document: vscode.TextDocument, position: vscode.Position): string | null {
  const range = document.getWordRangeAtPosition(position, /\[\[[^\]]*\]\]/)
  if (range === undefined) return null
  return document.getText(range).replace(/\[\[([^\]]*)\]\]/, "$1")
}

async function listUids() {
  return (await vscode.workspace.fs.readDirectory(vscode.Uri.file(zettelsDir)))
    .filter(entry => entry[1] === vscode.FileType.File && entry[0].endsWith(extension))
    .map(entry => path.basename(entry[0], extension))
}

class NodeCompletionItemProvider implements vscode.CompletionItemProvider {
  public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
    if (getLinkedUid(document, position) === null) return []
    return (await listUids()).map(uid => new vscode.CompletionItem(uid, vscode.CompletionItemKind.File))
  }
}

class NodeDefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
    const uid = getLinkedUid(document, position)
    if (uid === null) return []
    const file = uidToFileUri(uid)
    return [new vscode.Location(file, positionAfterSeperator(await vscode.workspace.openTextDocument(file)))]
  }
}

class NodeDocumentLinkProvider implements vscode.DocumentLinkProvider {
  private document: vscode.TextDocument | null = null

  provideDocumentLinks(document: vscode.TextDocument) {
    this.document = document
    return Array.from(
      document.getText().matchAll(/\[\[[^\]]*\]\]/g),
      match =>
        new vscode.DocumentLink(
          new vscode.Range(
            document.positionAt(match.index! + "[[".length),
            document.positionAt(match.index! + match[0].length - "]]".length),
          ),
        ),
    )
  }

  async resolveDocumentLink(link: vscode.DocumentLink) {
    const uid = this.document!.getText(link.range)
    link.target = uidToFileUri(uid)
    return link
  }
}

class Zettel extends vscode.TreeItem {
  private text: string
  private truncation: string

  static create(uid: string) {
    return new Zettel(uid, vscode.TreeItemCollapsibleState.None)
  }

  constructor(private uid: string, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(uid, collapsibleState)
    // FIXME: Make a better label.
    // const label = id
    // // FIXME
    // const outgoing = []
    // const collapsibleState =
    //   outgoing.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    // super(label, collapsibleState)
    // // FIXME
    this.text = ""
    this.truncation = ""
  }

  // get description(): string {
  //   // FIXME
  //   return ""
  // }

  // iconPath = path.join(__filename, "..", "..", "resources", "post-it.svg")

  command = {
    title: "Show",
    command: "zettel.show",
    arguments: [this.uid],
  }

  contextValue = "zettel"
}

class NodeTreeDataProvider implements vscode.TreeDataProvider<Zettel> {
  getTreeItem(element: Zettel): vscode.TreeItem {
    return element
  }

  async getChildren(element?: Zettel) {
    if (element !== undefined) {
      // TODO: Find UIDs in element.
      return []
    } else {
      // TODO: Only list root nodes.
      return (await listUids()).map(uid => Zettel.create(uid))
    }
  }
}

export async function activate(context: vscode.ExtensionContext) {
  await fs.promises.mkdir(zettelsDir, { recursive: true })
  // TODO: Use context.workspaceState to keep an index of links.

  context.subscriptions.push(vscode.commands.registerCommand("zettel.newUid", () => newUid(context)))
  context.subscriptions.push(
    vscode.commands.registerCommand("zettel.parseClipboardTextToUid", () => parseClipboardTextToUid()),
  )
  context.subscriptions.push(vscode.commands.registerCommand("zettel.new", () => newZettel(context)))
  context.subscriptions.push(vscode.commands.registerCommand("zettel.open", () => openZettel()))
  context.subscriptions.push(vscode.commands.registerCommand("zettel.show", (uid: string) => showZettel(uid)))
  context.subscriptions.push(
    vscode.commands.registerCommand("zettel.showError", (uid: string) => showZettelError(uid)),
  )
  context.subscriptions.push(vscode.commands.registerCommand("zettel.uidToClipboard", () => uidToClipboard()))
  context.subscriptions.push(vscode.commands.registerCommand("zettel.urlToClipboard", () => urlToClipboard()))
  context.subscriptions.push(
    vscode.commands.registerCommand("zettel.linkToClipboard", () => linkToClipboard()),
  )
  context.subscriptions.push(vscode.commands.registerCommand("zettel.refreshIndex", () => refreshIndex()))

  const markdown = {
    scheme: "file",
    language: "markdown",
  }
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(markdown, new NodeCompletionItemProvider()),
  )
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(markdown, new NodeDefinitionProvider()),
  )
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(markdown, new NodeDocumentLinkProvider()),
  )

  vscode.workspace.onWillSaveTextDocument(event => event.waitUntil(Promise.resolve(onSave(event.document))))

  vscode.window.registerTreeDataProvider("zettelOutboundLinks", new NodeTreeDataProvider())
}
