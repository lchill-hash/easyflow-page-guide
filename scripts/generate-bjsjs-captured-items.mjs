import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

function textHash(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

const rawItems = [
  {
    elementId: "ef-h-1",
    type: "heading",
    tagName: "h2",
    text: "养老知识问答场景超市",
    domPath: "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(1) > h2:nth-of-type(1)",
  },
  {
    elementId: "ef-h-2",
    type: "heading",
    tagName: "h2",
    text: "高龄老年人津贴办理指南",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > h2:nth-of-type(1)",
  },
  {
    elementId: "ef-p-1",
    type: "paragraph",
    tagName: "p",
    text: "日期:2026-01-26 09:16 来源:北京市民政局",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > p:nth-of-type(1)",
  },
  {
    elementId: "ef-p-2",
    type: "paragraph",
    tagName: "p",
    titleCandidate: true,
    text: "办理条件：",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > p:nth-of-type(1)",
  },
  {
    elementId: "ef-p-3",
    type: "paragraph",
    tagName: "div",
    text: "具有本市户籍，且年满80周岁及以上的老年人可申请办理高龄老年人津贴。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(1)",
  },
  {
    elementId: "ef-p-4",
    type: "paragraph",
    tagName: "div",
    titleCandidate: true,
    text: "办理流程：",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(3)",
  },
  {
    elementId: "ef-p-5",
    type: "paragraph",
    tagName: "div",
    text: "1、提出申请",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(4)",
  },
  {
    elementId: "ef-p-6",
    type: "paragraph",
    tagName: "div",
    text: "由符合申请条件的老年人本人或其委托代理人，或监护人通过以下两种方式自愿申请：",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(5)",
  },
  {
    elementId: "ef-p-7",
    type: "paragraph",
    tagName: "div",
    text: "网上申请：申请人可登录北京市政务服务网、北京市民政局官方网站或微信公众号，输入姓名和身份证号码后填报申请。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(6)",
  },
  {
    elementId: "ef-p-8",
    type: "paragraph",
    tagName: "div",
    text: "现场申请：可以就近在本市任一街道(乡镇)办事窗口出示居民身份证或户口簿原件提出申请。或在社区(村)或街道(乡镇)领取并填写《北京市老年人养老服务补贴津贴申请表》后，到户籍所在地街道(乡镇)社会救助或“一门受理”窗口出示居民身份证或户口簿原件后提交。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(7)",
  },
  {
    elementId: "ef-p-9",
    type: "paragraph",
    tagName: "div",
    text: "注：在2019年10月25日前尚未提出申请的，由北京市社会福利综合管理平台通过老年人预留的手机号码推送养老服务津贴发放通知，确认回复后，综合管理平台直接生成并发放津贴至老年人持有的银行账户。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(8)",
  },
  {
    elementId: "ef-p-10",
    type: "paragraph",
    tagName: "div",
    text: "2、审核",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(9)",
  },
  {
    elementId: "ef-p-11",
    type: "paragraph",
    tagName: "div",
    text: "各街道(乡镇)受理窗口通过综合管理平台接受申请，或现场确认申请材料后将信息归集至综合管理平台的北京市老年人养老服务补贴津贴管理系统；原则上于接收当日转街道(乡镇)负责民政业务的科室，由其进行初审后从系统转报区民政局。每月20日前，各街道(乡镇)将有异议的人员数据汇总报送区民政局。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(10)",
  },
  {
    elementId: "ef-p-12",
    type: "paragraph",
    tagName: "div",
    text: "区民政局于每月25日前作出审定意见。审定不合格的，提出意见并通过街道(乡镇)受理申请窗口书面告知当事人，说明理由、救济途径及时限，并将申请材料电子归档、妥善保存；审定合格的，报区财政局拨付资金。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(11)",
  },
  {
    elementId: "ef-p-13",
    type: "paragraph",
    tagName: "div",
    text: "3、津贴发放",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(12)",
  },
  {
    elementId: "ef-p-14",
    type: "paragraph",
    tagName: "div",
    text: "老年人养老服务津贴按月发放，审定合格的自递交申请当月计发，每月月底前发放下月津贴。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(13)",
  },
  {
    elementId: "ef-p-15",
    type: "paragraph",
    tagName: "div",
    text: "自实施之日起，因申请人自身或其他原因，延误申请超过半年的，从符合条件且提交申请的当月起计发。延误申请时间在6个月以内的，按规定提交申请后从符合条件的当月起予以计发。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(14)",
  },
  {
    elementId: "ef-p-16",
    type: "paragraph",
    tagName: "div",
    text: "注：利用综合管理平台完成申请受理、待遇审批等业务流程，经过资金核算后，通过统发平台，对接金融机构转账，存入申请人在申请时确认的银行卡金融借记账户。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(15)",
  },
  {
    elementId: "ef-p-17",
    type: "paragraph",
    tagName: "div",
    text: "申请人可以用已持有的“北京通—养老助残卡”、“北京通—民政一卡通”、“北京通—残疾人服务一卡通”、特殊家庭老年人扶助卡、“北京通-第三代社会保障卡”、军人保障卡中的一个作为养老服务补贴津贴发放的账户。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(16)",
  },
  {
    elementId: "ef-p-18",
    type: "paragraph",
    tagName: "div",
    text: "其中用持有“北京通—养老助残卡”作为发放账户的老年人，其80-89周岁年龄段的高龄津贴按原居家养老服务补贴发放方式和渠道执行、护理补贴不得提现。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(17)",
  },
  {
    elementId: "ef-p-19",
    type: "paragraph",
    tagName: "div",
    titleCandidate: true,
    text: "发放标准：",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(19)",
  },
  {
    elementId: "ef-p-20",
    type: "paragraph",
    tagName: "div",
    text: "80周岁至89周岁的老年人，津贴标准为每人每月100元。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(20)",
  },
  {
    elementId: "ef-p-21",
    type: "paragraph",
    tagName: "div",
    text: "90周岁至99周岁的老年人，津贴标准为每人每月500元。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(21)",
  },
  {
    elementId: "ef-p-22",
    type: "paragraph",
    tagName: "div",
    text: "100周岁及以上的老年人，津贴标准为每人每月800元。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(22)",
  },
  {
    elementId: "ef-p-23",
    type: "paragraph",
    tagName: "div",
    text: "4、复核",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(23)",
  },
  {
    elementId: "ef-p-24",
    type: "paragraph",
    tagName: "div",
    text: "老年人养老服务津贴的复核采取区民政局通过综合管理平台定期复核，至少每季度一次；或者由个人自主申报复核。",
    domPath:
      "html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(24)",
  },
];

const items = rawItems.map((item, order) => ({
  elementId: item.elementId,
  type: item.type,
  text: item.text,
  textLength: item.text.length,
  truncated: false,
  order,
  region: "unknown",
  domPath: item.domPath,
  textHash: textHash(item.text),
  tagName: item.tagName,
  ...(item.titleCandidate === true ? { titleCandidate: true } : {}),
}));

const fixture = {
  sourceUrl:
    "https://www.bjsjs.gov.cn/gongkai/zwgkpd/ztzl/2024/wqfw/lnrzq/cjcs/202402/t20240229_79299.shtml",
  capturedAt: "2026-11-13T10:16:02.894Z",
  note: "Captured raw visible items from the public page HTML structure (p/div/strong order); not ideal SemanticSegments.",
  title: "高龄老年人津贴办理指南",
  domain: "www.bjsjs.gov.cn",
  items,
};

await writeFile(
  join(root, "scripts", "fixtures", "bjsjs-captured-items.json"),
  JSON.stringify(fixture, null, 2),
  "utf8",
);
console.log(`wrote ${items.length} captured items`);