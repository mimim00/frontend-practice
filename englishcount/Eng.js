/**统计单词频率  */
const countWords = (text) => {
    if (typeof text !== 'string' || text.trim() === '') {
        return {};
    }
    // 转小写按空白字符分割，过滤空字符串
    const words = text.toLowerCase().split(/\s+/).filter(word => word !== '');
    // reduce 累计计数
    return words.reduce((countObj, word) => {
        countObj[word] = (countObj[word] || 0) + 1;
        return countObj;
    }, {});
};

// 测试
const testText = 'hello world hello javascript world Hello JS';
console.log(countWords(testText));
// 输出: { hello: 3, world: 2, javascript: 1, js: 1 }
