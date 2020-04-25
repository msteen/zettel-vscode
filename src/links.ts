import * as vscode from "vscode"
import * as path from "path"
import { getLinkedUid, positionAtInitCursorPattern } from "./utils"
import { Zettel } from "./zettel"

const _onWillOpenLink = new vscode.EventEmitter<Zettel>()

export module Links {
  export const onWillOpen = _onWillOpenLink.event
}

export class ZettelCompletionItemProvider implements vscode.CompletionItemProvider {
  public async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
    if (getLinkedUid(document, position) === null) return []
    return Zettel.uids.map(uid => new vscode.CompletionItem(uid, vscode.CompletionItemKind.File))
  }
}

export class ZettelDefinitionProvider implements vscode.DefinitionProvider {
  public async provideDefinition(document: vscode.TextDocument, position: vscode.Position) {
    const zettel = Zettel.from(getLinkedUid(document, position))
    if (zettel === null) return []
    _onWillOpenLink.fire(zettel)
    const file = zettel.fileUri
    return [
      new vscode.Location(file, positionAtInitCursorPattern(await vscode.workspace.openTextDocument(file))),
    ]
  }
}

export class ZettelDocumentLinkProvider implements vscode.DocumentLinkProvider {
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
    const zettel = Zettel.from(uid)
    if (zettel !== null) {
      _onWillOpenLink.fire(zettel)
      link.target = zettel.fileUri
    } else {
      link.target = vscode.Uri.parse(`command:zettel.new?${encodeURIComponent(JSON.stringify({ uid }))}`)
    }
    return link
  }
}
