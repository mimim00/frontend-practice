const bills = [
    { title: "奶茶", category: "餐饮", money: 18, time: "2026‑09‑01" },
    { title: "地铁", category: "交通", money: 4, time: "2026‑09‑01" },
    { title: "外卖", category: "餐饮", money: 32, time: "2026‑09‑02" },
    { title: "网购衣服", category: "购物", money: 299, time: "2026‑09‑03" },
    { title: "无效记录1", category: "餐饮", money: -50, time: "2026‑09‑02" },
    { title: "无效记录2", category: "", money: 100, time: "2026‑09‑03" },
    { title: "无效记录3", category: "购物", money: null, time: "2026‑09‑04" }
];
console.log("====原始账单数据====");
console.table(bills);

/**数据清洗 */
const cleanBills = (list) => {
    return list.filter(item => {
        return typeof item.money === 'number'
            && item.money > 0
            && typeof item.category === 'string'
            && item.category !== '';
    });
};

/**计算总金额 */
const getTotalCost = (list) => {
    if (list.length === 0) return 0;
    return list.reduce((sum, bill) => sum + bill.money, 0);
};

/**按类别获取账单 */
const getBillsByCategory = (list, category) => {
    return list.filter(bill => bill.category === category);
};

/**获取账单报告 */
const getBillReport = (originList) => {
    const validList = cleanBills(originList);
    if (validList.length === 0) {
        return "没有有效的消费记录";
    }

    const total = getTotalCost(validList);
    const foodBills = getBillsByCategory(validList, "餐饮");
    const foodTotal = getTotalCost(foodBills);

    return `
===== 消费记账报告 =====
原始记录数：${originList.length} 条
合法有效记录：${validList.length} 条
全部总花费：${total.toFixed(2)} 元
餐饮类花费：${foodTotal.toFixed(2)} 元
餐饮记录共 ${foodBills.length} 条
`;
};

try {
    const validData = cleanBills(bills);
    console.log("====清洗之后合法账单====");
    console.table(validData);
    console.log(getBillReport(bills));
    console.log("【空数据测试】" + getBillReport([]));
} catch (e) {
    console.error("记账工具运行出错：", e.message);
}
