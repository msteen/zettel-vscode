import * as fs from "fs"
import * as moment from "moment"
import * as vscode from "vscode"
import { config } from "./config"
import { nextUidInput, getLinkedUid } from "./utils"
import { Zettel } from "./zettel"

export async function newZettel(context: vscode.ExtensionContext, uid?: string) {
  const input = nextUidInput(context)
  const zettel = Zettel.create(
    uid || config.formatUid(input),
    config.uidInput === "timestamp" ? (input as moment.Moment) : undefined,
  )
  const content = config.formatContent(zettel.uid)
  try {
    await fs.promises.writeFile(zettel.file, content, { flag: "wx" })
    zettel.updateContent()
    await zettel.show()
  } catch (e) {
    await vscode.window.showErrorMessage(`File '${zettel.file}' could not be created.`)
  }
}

export function newUid(context: vscode.ExtensionContext) {
  return vscode.env.clipboard.writeText(config.formatUid(nextUidInput(context)))
}

async function pickZettel() {
  const item = await vscode.window.showQuickPick(
    Zettel.zettels.map(zettel => ({
      id: zettel.uid,
      label: zettel.label,
    })),
  )
  const zettel = Zettel.from(item?.id)
  if (zettel === null) return
  await zettel.show()
}

export async function openZettel() {
  const editor = vscode.window.activeTextEditor!
  let zettel = Zettel.from(getLinkedUid(editor.document, editor.selection.start))
  if (zettel !== null) {
    await zettel.show()
  } else {
    await pickZettel()
  }
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

export async function parseClipboardTextToUid() {
  const text = await vscode.env.clipboard.readText()
  const input = config.uidInput === "timestamp" ? await parseTimestamp(text) : parseCount(text)
  if (input !== null) {
    vscode.env.clipboard.writeText(config.formatUid(input))
  } else {
    vscode.window.showErrorMessage(`Could not parse clipboard text '${text}' to a ${config.uidInput}.`)
  }
}

export function refreshAll() {
  return Zettel.reload()
}

export function showZettel(zettel: Zettel) {
  return zettel.show()
}

export function uidToClipboard() {
  return vscode.env.clipboard.writeText(Zettel.active!.uid)
}

export function urlToClipboard() {
  return vscode.env.clipboard.writeText(config.formatUrl(Zettel.active!.uid))
}

export function linkToClipboard() {
  // TODO: Get the title, truncation, or moment to represent the zettel in one line.
  // vscode.env.clipboard.writeText(`[](zettel://${Zettel.active!.uid})`)
  return vscode.env.clipboard.writeText(`[[${Zettel.active!.uid}]]`)
}
