const arr = [1,2,3,4,5,6,7,8];
// 一行链式：filter筛偶数 → map平方 → reduce求和
const res = arr
  .filter(item => item % 2 === 0)
  .map(item => item * item)
  .reduce((sum, num) => sum + num, 0);

console.log("第2题偶数平方和", res);
// 计算：2²+4²+6²+8² = 4+16+36+64 = 120
