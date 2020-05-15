import * as moment from "moment"

export = function formatContent(uid: string, created: number, title?: string) {
  const timestamp = moment(created).toISOString(true)
  return `---
UID: ${uid}
Created: ${timestamp}
Modified: ${timestamp}
---
${title ? `# ${title}\n` : ""}`
}
