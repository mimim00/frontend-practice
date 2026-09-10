console.log("===== 第3题：待排查bug代码 =====");
// Bug1：忘记写return
function calc(a,b){
    const sum = a + b;
    // 缺少 return sum;
}
console.log("Bug1结果：", calc(1,2)); // undefined

// Bug2：使用 == 弱相等
let num = "10";
if(num == 10){
    console.log("Bug2：== 发生隐式类型转换，应该用 === ");
}

// Bug3：数组越界访问
const list = [10,20,30];
console.log("Bug3数组越界取值：", list[9]); // undefined

// Bug4：产生NaN
const n = Number("abc");
const total = n * 5;
console.log("Bug4 NaN计算结果：", total);

// Bug5：undefined上读取属性，会直接报错
let user;
console.log("Bug5 undefined取属性：", user.name);
