export function reasonText(reason) {
  if (reason === "required") return "必填未填";
  if (reason === "collapsed") return "位于折叠区域";
  if (reason === "not_on_page") return "当前字段不在本页";
  if (reason === "match_failed") return "匹配失败";
  return "空值";
}
