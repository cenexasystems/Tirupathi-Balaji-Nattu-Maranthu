const fs = require('fs');

// Lightweight copy of the original product generator
const productsSql = '-- generated product SQL (trimmed for bootstrap folder)'

fs.writeFileSync(__dirname + '/generateProducts.js-output', productsSql)
