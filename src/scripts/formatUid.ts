import * as moment from "moment"

export = function formatId(timestamp: number) {
  return moment(timestamp).format("YYYYMMDDHHmmss")
}
