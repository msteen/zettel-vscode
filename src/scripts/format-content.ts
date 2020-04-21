import * as moment from "moment"

export = function templateContent(uid: string, uidInput: string, input: number) {
  const timestamp = (uidInput === "timestamp" ? moment(input) : moment()).toISOString(true)
  return `---
UID: ${uid}
Created: ${timestamp}
Modified: ${timestamp}
---
`
}
