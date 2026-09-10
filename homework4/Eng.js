// ========== 第1题：统计单词频率 ==========
const countWords = (text) => {
  if (typeof text !== 'string' || text.trim() === '') {
    return {};
  }
  // 转小写，分割空白，过滤空字符串
  const words = text.toLowerCase().split(/\s+/).filter(word => word);
  return words.reduce((countObj, word) => {
    countObj[word] = (countObj[word] || 0) + 1;
    return countObj;
  }, {});
};
const testText = 'hello world hello javascript world hello';
console.log("第1题单词统计：", countWords(testText));
