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
