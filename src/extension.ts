// https://github.com/monferrand/mzettel
// https://github.com/kortina/vscode-markdown-notes
// https://github.com/nergal-perm/zettelkasten-vscode
// https://gitlab.com/memorize_it/memorize/-/tree/master

import * as fs from "fs"
import * as vscode from "vscode"
import { inspect } from "util"
import { config } from "./config"
import { Zettel } from "./zettel"
import { ZettelCompletionItemProvider, ZettelDefinitionProvider, ZettelDocumentLinkProvider } from "./links"
import {
  showZettel,
  newUid,
  parseClipboardTextToUid,
  newZettel,
  openZettel,
  uidToClipboard,
  urlToClipboard,
  linkToClipboard,
  refreshAll,
} from "./commands"
import { activateOutboundLinksView } from "./views/outboundLinks"
import { activateWarningsView } from "./views/warnings"
import { activateInboundLinksView } from "./views/inboundLinks"
import { activateStoryRiverView } from "./views/storyRiver"

// @ts-ignore
global.inspect = (...args: any[]) => console.log(...args.map(inspect))

export async function activate(context: vscode.ExtensionContext) {
  await fs.promises.mkdir(config.zettelsFolder, { recursive: true })
  await refreshAll()

  const { registerCommand } = vscode.commands
  context.subscriptions.push(
    ...[
      registerCommand("zettel.newUid", () => newUid(context)),
      registerCommand("zettel.parseClipboardTextToUid", () => parseClipboardTextToUid()),
      registerCommand("zettel.new", args => newZettel(context, args?.uid)),
      registerCommand("zettel.open", () => openZettel()),
      registerCommand("zettel.show", (zettel: Zettel) => showZettel(zettel)),
      registerCommand("zettel.uidToClipboard", () => uidToClipboard()),
      registerCommand("zettel.urlToClipboard", () => urlToClipboard()),
      registerCommand("zettel.linkToClipboard", () => linkToClipboard()),
      registerCommand("zettel.refreshAll", () => refreshAll()),
    ],
  )

  const markdown = {
    scheme: "file",
    language: "markdown",
  }
  context.subscriptions.push(
    ...[
      vscode.languages.registerCompletionItemProvider(markdown, new ZettelCompletionItemProvider()),
      vscode.languages.registerDefinitionProvider(markdown, new ZettelDefinitionProvider()),
      vscode.languages.registerDocumentLinkProvider(markdown, new ZettelDocumentLinkProvider()),
    ],
  )

  activateWarningsView()
  activateStoryRiverView()
  activateOutboundLinksView()
  activateInboundLinksView()

  vscode.workspace.onWillSaveTextDocument(event => {
    if (event.document.uri.fsPath.endsWith(config.extension)) {
      event.waitUntil(Promise.resolve(config.onSave(event.document)))
    }
  })

  const zettel = Zettel.from(vscode.window.activeTextEditor?.document.uri)
  if (zettel) Zettel.activate(zettel)
}
