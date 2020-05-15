import * as vscode from "vscode"
import { positionAtInitCursorPattern } from "./utils"
import { Zettel } from "./zettel"
import { config } from "./config"
import { newZettel } from "./commands"

export enum LinkType {
  Wiki,
  Ref,
  Url,
}

export type Link = {
  type: LinkType
  text: string
  zettel?: Zettel
}

function parseLink(text: string): Link {
  let type: LinkType, zettel: Zettel | undefined
  if (text.startsWith("[[")) {
    type = LinkType.Wiki
    text = text.substring("[[".length, text.length - "]]".length)
    zettel = Zettel.fromTitle(text)
  } else if (text.startsWith("[#")) {
    type = LinkType.Ref
    text = text.substring("[#".length, text.length - "]".length)
    zettel = Zettel.from(text)
  } else if (text.startsWith(config.urlSchema)) {
    type = LinkType.Url
    text = text.substring(config.urlSchema.length + "://".length)
    zettel = Zettel.from(text)
  } else {
    throw new Error(`Text '${text}' could not be parsed as a link.`)
  }
  return { type, text, zettel }
}

function newZettelArgs(link: Link) {
  return link.type === LinkType.Wiki ? { title: link.text } : { uid: link.text }
}

function getLinkUri(link: Link) {
  if (link.zettel) {
    return link.zettel.fileUri
  } else {
    return vscode.Uri.parse(`command:zettel.new?${encodeURIComponent(JSON.stringify(newZettelArgs(link)))}`)
  }
}

const linkPattern = `\\[\\[[^\\]]*\\]\\]|\\[#[^\\]]*\\]|${config.urlSchema}:\\/\\/[0-9a-zA-Z-_]+`
const linksRegex = new RegExp(linkPattern, "g")
const linkRegex = new RegExp(linkPattern)

export function getLinkAtPosition(document: vscode.TextDocument, position: vscode.Position) {
  const range = document.getWordRangeAtPosition(position, linkRegex)
  if (!range) return undefined
  const text = document.getText(range)
  return parseLink(text)
}

export function getLinkedZettelAtPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
): Zettel | undefined {
  return getLinkAtPosition(document, position)?.zettel
}

export function getLinks(content: string) {
  return Array.from(content.matchAll(linksRegex), match => {
    const index = match.index!
    const text = match[0]
    const length = text.length
    const link = parseLink(text)
    return { index, length, link }
  })
}

const _onWillOpenLink = new vscode.EventEmitter<Zettel>()

export module Links {
  export const onWillOpen = _onWillOpenLink.event
}

export class ZettelCompletionItemProvider implements vscode.CompletionItemProvider {
  public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
    if (!getLinkedZettelAtPosition(document, position)) return []
    return Zettel.uids.map(uid => new vscode.CompletionItem(uid, vscode.CompletionItemKind.File))
  }
}

export class ZettelDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  public async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
    const link = getLinkAtPosition(document, position)
    if (!link) return []
    if (link.zettel) {
      _onWillOpenLink.fire(link.zettel)
    } else {
      link.zettel = await newZettel(this.context, newZettelArgs(link))
      if (!link.zettel) return []
    }
    return [
      new vscode.Location(
        link.zettel.fileUri,
        positionAtInitCursorPattern(await vscode.workspace.openTextDocument(link.zettel.fileUri)),
      ),
    ]
  }
}

class ZettelLink extends vscode.DocumentLink {
  constructor(range: vscode.Range, target: vscode.Uri, public readonly zettel?: Zettel) {
    super(range, target)
  }
}

export class ZettelDocumentLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(document: vscode.TextDocument) {
    return getLinks(document.getText()).map(arg => {
      const { index, length, link } = arg
      let start = 0,
        end = 0
      if (arg.link.type === LinkType.Wiki) {
        start = "[[".length
        end = "]]".length
      } else if (arg.link.type === LinkType.Ref) {
        start = "[#".length
        end = "]".length
      } else if (arg.link.type === LinkType.Url) {
        start = config.urlSchema.length + "://".length
      }
      const range = new vscode.Range(
        document.positionAt(index + start),
        document.positionAt(index + length - end),
      )
      const uri = getLinkUri(link)
      return new ZettelLink(range, uri, link.zettel)
    })
  }

  resolveDocumentLink(link: ZettelLink) {
    _onWillOpenLink.fire(link.zettel)
    return link
  }
}
