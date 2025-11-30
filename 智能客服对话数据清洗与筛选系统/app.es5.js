// ==========================================
// 完整修复版 app.es5.js (含积存金配置 + 关键词编辑器 + 重置功能)
// 兼容 IE9+ 和旧版浏览器
// ==========================================

(function() {
    'use strict';
    
    console.log('开始加载应用...');
    
    // ==========================================
    // 1. 安全的 localStorage 包装器
    // ==========================================
    var SafeStorage = {
        _memoryStorage: {},
        
        isAvailable: function() {
            try {
                var test = '__storage_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch(e) {
                console.warn('localStorage 不可用:', e.message);
                return false;
            }
        },
        
        getItem: function(key, defaultValue) {
            if (!this.isAvailable()) {
                return this._memoryStorage[key] !== undefined ? 
                       this._memoryStorage[key] : defaultValue;
            }
            try {
                var value = localStorage.getItem(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch(e) {
                console.error('读取存储失败:', e);
                return defaultValue;
            }
        },
        
        setItem: function(key, value) {
            if (!this.isAvailable()) {
                this._memoryStorage[key] = value;
                return true;
            }
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch(e) {
                console.error('保存到存储失败:', e);
                this._memoryStorage[key] = value;
                return false;
            }
        },

        removeItem: function(key) {
            if (this.isAvailable()) {
                localStorage.removeItem(key);
            } else {
                delete this._memoryStorage[key];
            }
        }
    };
    
    // ==========================================
    // 2. 文件处理工具类
    // ==========================================
    var FileUtils = {
        readFile: function(file) {
            return new Promise(function(resolve, reject) {
                if (!file) {
                    reject(new Error('未选择文件'));
                    return;
                }
                
                var reader = new FileReader();
                
                reader.onload = function(e) {
                    try {
                        var data = new Uint8Array(e.target.result);
                        // 尝试使用不同的编码进行读取
                        var workbook = XLSX.read(data, { type: 'array' });
                        var firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        var jsonData = XLSX.utils.sheet_to_json(firstSheet);
                        
                        console.log('文件解析完成,数据行数:', jsonData.length);
                        resolve(jsonData);
                    } catch (error) {
                        console.error('文件解析错误:', error);
                        reject(new Error('文件解析失败: 请确认文件格式为 XLSX/CSV 且未损坏。'));
                    }
                };
                
                reader.onerror = function() {
                    reject(new Error('文件读取失败'));
                };
                
                reader.readAsArrayBuffer(file);
            });
        },
        
        writeFile: function(data, filename) {
            try {
                var worksheet = XLSX.utils.json_to_sheet(data);
                var workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, '分类结果');
                XLSX.writeFile(workbook, filename);
                console.log('文件下载成功:', filename);
            } catch (error) {
                console.error('文件下载错误:', error);
                throw new Error('文件下载失败: ' + error.message);
            }
        }
    };
    
    // ==========================================
    // 3. 数据处理器 (已更新：包含积存金配置)
    // ==========================================
    var DataProcessor = {
        // [关键修改] 这里是默认关键词配置
        DEFAULT_KEYWORDS: {
            '账户问题': ['密码', '账号', '登录', '注册'],
            '转账汇款': ['转账', '汇款', '到账', '收款'],
            '信用卡': ['信用卡', '还款', '账单', '额度'],
            '理财产品': ['理财', '基金', '收益', '投资'],
            '积存金': ['京东', '支付宝', '积存金'], // [新增] 积存金分类
            '其他': []
        },
        
        process: function(rawData, keywordsMap) {
            console.log('开始处理数据,共', rawData.length, '条');
            
            var classifiedData = [];
            var stats = {
                total: rawData.length,
                classifiedCount: 0,
                unclassifiedCount: 0,
                categories: {}
            };
            
            for (var category in keywordsMap) {
                stats.categories[category] = 0;
            }
            
            for (var i = 0; i < rawData.length; i++) {
                var row = rawData[i];
                var content = row['对话内容'] || '';
                var classified = false;
                var matchedKeywords = [];
                
                for (var category in keywordsMap) {
                    var keywords = keywordsMap[category];
                    
                    for (var j = 0; j < keywords.length; j++) {
                        var keyword = keywords[j];
                        if (content.indexOf(keyword) !== -1) {
                            row['分类结果'] = category;
                            matchedKeywords.push(keyword);
                            classified = true;
                            stats.categories[category]++;
                            break;
                        }
                    }
                    
                    if (classified) break;
                }
                
                if (!classified) {
                    row['分类结果'] = '未分类';
                    stats.unclassifiedCount++;
                } else {
                    row['命中关键词'] = matchedKeywords.join(', ');
                    stats.classifiedCount++;
                }
                
                classifiedData.push(row);
            }
            
            console.log('数据处理完成:', stats);
            return {
                classifiedData: classifiedData,
                stats: stats
            };
        }
    };
    
    // ==========================================
    // 4. UI 组件 - 图标
    // ==========================================
    var Icons = {
        Upload: function(props) {
            return React.createElement('svg', {
                className: props.className || '',
                width: '24', height: '24', viewBox: '0 0 24 24',
                fill: 'none', stroke: 'currentColor', strokeWidth: '2'
            },
                React.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
                React.createElement('polyline', { points: '17 8 12 3 7 8' }),
                React.createElement('line', { x1: '12', y1: '3', x2: '12', y2: '15' })
            );
        },
        Download: function(props) {
            return React.createElement('svg', {
                className: props.className || '',
                width: '24', height: '24', viewBox: '0 0 24 24',
                fill: 'none', stroke: 'currentColor', strokeWidth: '2'
            },
                React.createElement('path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }),
                React.createElement('polyline', { points: '7 10 12 15 17 10' }),
                React.createElement('line', { x1: '12', y1: '15', x2: '12', y2: '3' })
            );
        },
        Trash: function(props) {
            return React.createElement('svg', {
                className: props.className || '',
                width: '16', height: '16', viewBox: '0 0 24 24',
                fill: 'none', stroke: 'currentColor', strokeWidth: '2',
                style: { verticalAlign: 'middle', marginLeft: '4px' }
            },
                React.createElement('polyline', { points: '3 6 5 6 21 6' }),
                React.createElement('path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' })
            );
        }
    };
    
    // ==========================================
    // 5. UI 组件 - 处理日志
    // ==========================================
    var ProcessingLog = function(props) {
        var logs = props.logs || [];
        
        return React.createElement('div', {
            style: {
                backgroundColor: '#1e293b',
                borderRadius: '8px',
                padding: '16px',
                maxHeight: '300px',
                overflowY: 'auto',
                fontFamily: 'Consolas, monospace',
                fontSize: '13px'
            }
        },
            React.createElement('div', {
                style: { color: '#94a3b8', marginBottom: '12px', fontWeight: 'bold' }
            }, '处理日志'),
            
            logs.length === 0 ? 
                React.createElement('div', {
                    style: { color: '#64748b', textAlign: 'center', padding: '20px' }
                }, '暂无日志...') :
                logs.map(function(log, index) {
                    var color = log.type === 'error' ? '#ef4444' :
                               log.type === 'success' ? '#10b981' :
                               log.type === 'warning' ? '#f59e0b' : '#60a5fa';
                    
                    return React.createElement('div', {
                        key: index,
                        style: { marginBottom: '8px', color: color, lineHeight: '1.5' }
                    },
                        React.createElement('span', {
                            style: { color: '#94a3b8', marginRight: '8px' }
                        }, '[' + log.time + ']'),
                        log.message
                    );
                })
        );
    };
    
    // ==========================================
    // 6. UI 组件 - 关键词编辑器 (含添加/删除/重置功能)
    // ==========================================
    var KeywordEditor = function(props) {
        var keywords = props.keywords || {};
        var onUpdate = props.onUpdate;
        var addLog = props.addLog;
        
        // State for new keyword inputs
        var newCategoryState = React.useState('');
        var newCategoryName = newCategoryState[0];
        var setNewCategoryName = newCategoryState[1];
        
        var newKeywordsState = React.useState('');
        var newKeywordsInput = newKeywordsState[0];
        var setNewKeywordsInput = newKeywordsState[1];
        
        // [功能 1] 恢复默认设置 (刷新模块)
        var handleReset = function() {
            var msg = '确定要丢弃当前自定义配置，恢复到代码中的默认关键词吗？\n(这会清除浏览器存储并应用最新的配置)';
            if (window.confirm(msg)) {
                SafeStorage.removeItem('bankFilterKeywords');
                onUpdate(DataProcessor.DEFAULT_KEYWORDS);
                addLog('关键词已恢复到默认配置。', 'success');
            }
        };

        // [功能 2] 添加新分类或关键词
        var handleAddCategory = function() {
            var catName = newCategoryName.trim();
            var kwList = newKeywordsInput.split(/[,，\s]+/).filter(function(kw) { return kw.length > 0; });

            if (!catName) {
                alert('分类名称不能为空。');
                return;
            }

            var updatedKeywords = Object.assign({}, keywords);
            
            // 检查分类是否已存在
            if (updatedKeywords.hasOwnProperty(catName)) {
                // 如果存在，则合并关键词
                var existingKeywords = updatedKeywords[catName];
                var newSet = {};
                existingKeywords.forEach(function(kw) { newSet[kw] = true; });
                kwList.forEach(function(kw) { newSet[kw] = true; });

                updatedKeywords[catName] = Object.keys(newSet);
                addLog('已向分类 "' + catName + '" 添加 ' + (Object.keys(newSet).length - existingKeywords.length) + ' 个关键词。', 'info');
            } else {
                // 如果不存在，则添加新分类
                updatedKeywords[catName] = kwList;
                addLog('已添加新分类 "' + catName + '"。', 'info');
            }

            onUpdate(updatedKeywords);
            setNewCategoryName('');
            setNewKeywordsInput('');
        };
        
        // [功能 3] 删除分类
        var handleDeleteCategory = function(category) {
            if (window.confirm('确定要永久删除分类 "' + category + '" 吗？')) {
                var updatedKeywords = Object.assign({}, keywords);
                delete updatedKeywords[category];
                onUpdate(updatedKeywords);
                addLog('已删除分类 "' + category + '"。', 'warning');
            }
        };
        
        var CategoryItem = function(props) {
            var category = props.category;
            var kwList = props.keywords;
            return React.createElement('div', {
                style: { 
                    marginBottom: '8px',
                    padding: '8px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start'
                }
            },
                React.createElement('div', { style: { flexGrow: 1 } },
                    React.createElement('strong', { style: { marginRight: '8px' } }, category + ': '),
                    kwList.join(', ') || '(无关键词)'
                ),
                React.createElement('button', {
                    onClick: function() { handleDeleteCategory(category); },
                    style: {
                        fontSize: '11px',
                        padding: '2px 6px',
                        backgroundColor: '#fecaca',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginLeft: '10px'
                    },
                    title: '删除此分类'
                }, '删除', React.createElement(Icons.Trash, { style: { width: '12px', height: '12px' } }))
            );
        };

        return React.createElement('div', {
            style: {
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '20px',
                border: '1px solid #e2e8f0'
            }
        },
            // 标题栏
            React.createElement('div', {
                style: { 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '16px'
                }
            },
                React.createElement('h3', {
                    style: { margin: 0, fontSize: '18px' }
                }, '关键词配置编辑器'),
                
                // 重置按钮 (刷新模块)
                React.createElement('button', {
                    onClick: handleReset,
                    style: {
                        fontSize: '12px',
                        padding: '6px 12px',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        border: '1px solid #93c5fd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    },
                    title: '清除缓存并加载代码中的最新默认配置'
                }, '⟲ 恢复默认设置 (刷新)')
            ),

            // 关键词列表
            React.createElement('div', {
                style: { marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }
            },
                Object.keys(keywords).map(function(category) {
                    return React.createElement(CategoryItem, {
                        key: category,
                        category: category,
                        keywords: keywords[category]
                    });
                })
            ),

            // 添加关键词区域 (添加关键词模块)
            React.createElement('div', { style: { borderTop: '1px solid #e2e8f0', paddingTop: '20px' } },
                React.createElement('h4', { style: { marginTop: 0, marginBottom: '10px', fontSize: '16px' } }, '添加/编辑关键词'),
                
                // 分类名称输入
                React.createElement('input', {
                    type: 'text',
                    placeholder: '分类名称 (例如：积存金)',
                    value: newCategoryName,
                    onChange: function(e) { setNewCategoryName(e.target.value); },
                    style: { 
                        width: '100%', padding: '8px', marginBottom: '10px', 
                        border: '1px solid #ccc', borderRadius: '4px' 
                    }
                }),

                // 关键词输入
                React.createElement('textarea', {
                    placeholder: '关键词列表 (逗号、顿号或空格分隔)',
                    value: newKeywordsInput,
                    onChange: function(e) { setNewKeywordsInput(e.target.value); },
                    rows: '3',
                    style: { 
                        width: '100%', padding: '8px', marginBottom: '10px', 
                        border: '1px solid #ccc', borderRadius: '4px' 
                    }
                }),

                // 提交按钮
                React.createElement('button', {
                    onClick: handleAddCategory,
                    style: {
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }
                }, '添加/合并关键词')
            )
        );
    };
    
    // ==========================================
    // 7. UI 组件 - 数据仪表板
    // ==========================================
    var Dashboard = function(props) {
        var stats = props.stats;
        
        if (!stats) return null;
        
        // 确保总数不为 0
        var classificationRate = stats.total > 0 ? Math.round(stats.classifiedCount / stats.total * 100) : 0;
        
        return React.createElement('div', {
            style: {
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '20px',
                border: '1px solid #e2e8f0'
            }
        },
            React.createElement('h3', {
                style: { marginTop: 0, marginBottom: '16px', fontSize: '18px' }
            }, '数据统计'),
            
            React.createElement('div', {
                style: { 
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px'
                }
            },
                React.createElement('div', { style: { padding: '12px', backgroundColor: '#dbeafe', borderRadius: '6px', textAlign: 'center' } },
                    React.createElement('div', { style: { fontSize: '24px', fontWeight: 'bold', color: '#1e40af' } }, stats.total),
                    React.createElement('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '4px' } }, '总记录数')
                ),
                React.createElement('div', { style: { padding: '12px', backgroundColor: '#d1fae5', borderRadius: '6px', textAlign: 'center' } },
                    React.createElement('div', { style: { fontSize: '24px', fontWeight: 'bold', color: '#065f46' } }, stats.classifiedCount),
                    React.createElement('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '4px' } }, '已分类')
                ),
                React.createElement('div', { style: { padding: '12px', backgroundColor: '#fee2e2', borderRadius: '6px', textAlign: 'center' } },
                    React.createElement('div', { style: { fontSize: '24px', fontWeight: 'bold', color: '#991b1b' } }, stats.unclassifiedCount),
                    React.createElement('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '4px' } }, '未分类')
                ),
                React.createElement('div', { style: { padding: '12px', backgroundColor: '#fef3c7', borderRadius: '6px', textAlign: 'center' } },
                    React.createElement('div', { style: { fontSize: '24px', fontWeight: 'bold', color: '#92400e' } }, classificationRate + '%'),
                    React.createElement('div', { style: { fontSize: '12px', color: '#64748b', marginTop: '4px' } }, '分类率')
                )
            ),
            
            React.createElement('div', { style: { fontSize: '14px' } },
                React.createElement('div', { style: { fontWeight: 'bold', marginBottom: '8px', color: '#475569' } }, '各分类统计:'),
                Object.keys(stats.categories).map(function(category, index) {
                    var count = stats.categories[category];
                    return React.createElement('div', {
                        key: index,
                        style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }
                    },
                        React.createElement('span', null, category),
                        React.createElement('span', { style: { fontWeight: 'bold', color: '#3b82f6' } }, count + ' 条')
                    );
                })
            )
        );
    };
    
    // ==========================================
    // 8. 主应用组件
    // ==========================================
    var App = function() {
        var fileState = React.useState(null);
        var file = fileState[0];
        var setFile = fileState[1];
        
        var dataState = React.useState(null);
        var processedData = dataState[0];
        var setProcessedData = dataState[1];
        
        var statsState = React.useState(null);
        var stats = statsState[0];
        var setStats = statsState[1];
        
        var logsState = React.useState([]);
        var logs = logsState[0];
        var setLogs = logsState[1];
        
        // 关键词状态管理
        var keywordsState = React.useState(function() {
            // 首次加载时，优先读取本地存储，否则使用默认配置
            return SafeStorage.getItem('bankFilterKeywords', DataProcessor.DEFAULT_KEYWORDS);
        });
        var keywords = keywordsState[0];
        var setKeywords = keywordsState[1];
        
        // 关键词变化时保存到本地存储
        React.useEffect(function() {
            SafeStorage.setItem('bankFilterKeywords', keywords);
        }, [keywords]);
        
        var addLog = function(message, type) {
            if (!type) type = 'info';
            var now = new Date();
            var time = [
                ('0' + now.getHours()).slice(-2),
                ('0' + now.getMinutes()).slice(-2),
                ('0' + now.getSeconds()).slice(-2)
            ].join(':');
            
            setLogs(function(prevLogs) {
                // 限制日志条数，防止内存溢出
                var newLogs = prevLogs.concat([{ time: time, message: message, type: type }]);
                return newLogs.slice(-50); // 只保留最近 50 条
            });
        };
        
        var handleFileChange = function(e) {
            var selectedFile = e.target.files[0];
            if (selectedFile) {
                setFile(selectedFile);
                setProcessedData(null);
                setStats(null);
                setLogs([]);
                addLog('已选中文件: ' + selectedFile.name, 'info');
            }
        };
        
        var handleProcessFile = function() {
            if (!file) {
                addLog('请先选择一个文件。', 'error');
                return;
            }
            
            addLog('开始读取文件...', 'info');
            
            FileUtils.readFile(file)
                .then(function(rawData) {
                    addLog('文件读取成功,共包含 ' + rawData.length + ' 条原始记录。', 'success');
                    
                    if (rawData.length > 0 && !rawData[0]['对话内容']) {
                        addLog('文件解析成功,但未找到必需的列名:"对话内容"。请确认文件格式正确。', 'error');
                        setFile(null);
                        return;
                    }
                    
                    addLog('开始进行关键词分类处理...', 'info');
                    var result = DataProcessor.process(rawData, keywords);
                    
                    setProcessedData(result.classifiedData);
                    setStats(result.stats);
                    addLog('处理完成,成功分类 ' + result.stats.classifiedCount + ' 条记录。', 'success');
                })
                .catch(function(error) {
                    addLog('处理失败: ' + error.message, 'error');
                    setFile(null);
                });
        };
        
        var handleDownload = function() {
            if (!processedData || processedData.length === 0) {
                addLog('没有可下载的数据。', 'error');
                return;
            }
            var baseName = file.name.replace(/\.[^/.]+$/, '');
            var filename = baseName + '_分类结果.xlsx';
            try {
                FileUtils.writeFile(processedData, filename);
                addLog('数据已成功下载为 ' + filename, 'success');
            } catch (error) {
                addLog('下载失败: ' + error.message, 'error');
            }
        };
        
        var handleClear = function() {
            setFile(null);
            setProcessedData(null);
            setStats(null);
            setLogs([]);
        };
        
        var handleUpdateKeywords = function(newKeywords) {
            setKeywords(newKeywords);
            // 这里不需要再添加 log，因为 log 已在 KeywordEditor 中添加
        };
        
        return React.createElement('div', {
            style: { padding: '32px', minHeight: '100vh', backgroundColor: '#f8fafc' }
        },
            React.createElement('header', {
                style: { marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }
            },
                React.createElement('h1', {
                    style: { fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#1e293b' }
                }, '银行客服日志清洗工具'),
                React.createElement('p', {
                    style: { color: '#64748b', margin: 0, fontSize: '14px' }
                }, '内网离线版 | 支持 XLSX/CSV 文件导入,进行关键词自动分类和统计。')
            ),
            
            React.createElement('div', {
                style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }
            },
                // 左侧面板
                React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
                    // 文件操作区
                    React.createElement('div', {
                        style: { backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0' }
                    },
                        React.createElement('h2', { style: { fontSize: '20px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#1e293b' } }, '文件操作'),
                        
                        React.createElement('div', { style: { marginBottom: '16px' } },
                            React.createElement('label', {
                                style: { 
                                    display: 'block', padding: '12px 20px', backgroundColor: '#3b82f6', color: 'white', 
                                    borderRadius: '8px', textAlign: 'center', cursor: 'pointer', fontWeight: 'bold',
                                    transition: 'background-color 0.2s'
                                }
                            },
                                React.createElement(Icons.Upload, { style: { marginRight: '8px', verticalAlign: 'middle' } }),
                                file ? '已选择: ' + file.name : '上传 Excel/CSV 文件',
                                React.createElement('input', {
                                    type: 'file',
                                    accept: '.xlsx,.xls,.csv',
                                    onChange: handleFileChange,
                                    style: { display: 'none' }
                                })
                            )
                        ),

                        React.createElement('div', { style: { display: 'flex', gap: '10px' } },
                            React.createElement('button', {
                                onClick: handleProcessFile,
                                disabled: !file || !!processedData,
                                style: {
                                    flex: 1, padding: '10px', backgroundColor: '#10b981', color: 'white', 
                                    border: 'none', borderRadius: '4px', cursor: !file || !!processedData ? 'not-allowed' : 'pointer',
                                    opacity: !file || !!processedData ? 0.6 : 1, fontWeight: 'bold'
                                }
                            }, '开始分类'),

                            React.createElement('button', {
                                onClick: handleDownload,
                                disabled: !processedData,
                                style: {
                                    flex: 1, padding: '10px', backgroundColor: '#f97316', color: 'white', 
                                    border: 'none', borderRadius: '4px', cursor: !processedData ? 'not-allowed' : 'pointer',
                                    opacity: !processedData ? 0.6 : 1, fontWeight: 'bold'
                                }
                            }, 
                                React.createElement(Icons.Download, { style: { marginRight: '4px', width: '16px', height: '16px', verticalAlign: 'middle' } }),
                                '下载结果'),
                                
                            React.createElement('button', {
                                onClick: handleClear,
                                style: {
                                    flex: 0, padding: '10px', backgroundColor: '#f1f5f9', color: '#64748b', 
                                    border: '1px solid #e2e8f0', borderRadius: '4px', cursor: 'pointer', width: '80px'
                                }
                            }, '清空')
                        )
                    ),
                    
                    // 日志区
                    React.createElement(ProcessingLog, { logs: logs })
                ),

                // 右侧面板
                React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
                    // 关键词编辑器
                    React.createElement(KeywordEditor, { 
                        keywords: keywords, 
                        onUpdate: handleUpdateKeywords,
                        addLog: addLog 
                    }),
                    
                    // 统计仪表板
                    React.createElement(Dashboard, { stats: stats })
                )
            )
        );
    };
    
    // ==========================================
    // 9. 应用启动与渲染
    // ==========================================
    function initializeApp() {
        console.log('准备渲染应用...');
        
        var rootElement = document.getElementById('root');
        if (!rootElement) {
            throw new Error('找不到 #root 元素');
        }
        
        rootElement.innerHTML = '';
        
        // 渲染应用
        ReactDOM.render(
            React.createElement(App, null),
            rootElement
        );
        
        // 隐藏加载提示
        var loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
        
        console.log('✓ 应用渲染成功!');
        
    }
    
    // 确保依赖加载完成后再启动应用
    // 此处假设 React, ReactDOM, XLSX 已通过 <script> 标签加载
    if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined' && typeof XLSX !== 'undefined') {
        initializeApp();
    } else {
        console.error('✗ 缺少必要的依赖库: React, ReactDOM 或 XLSX 未加载。');
        var rootEl = document.getElementById('root');
        if (rootEl) {
             rootEl.innerHTML = 
                '<div style="padding: 40px; margin: 40px; border: 2px solid #dc2626; ' +
                'background-color: #fee2e2; color: #991b1b; border-radius: 8px;">' +
                '<h2>应用启动失败</h2>' +
                '<p><strong>错误信息:</strong> 缺少必要的库: React, ReactDOM, 或 XLSX。</p>' +
                '<p>请检查 bank-filter-offline-compatible.html 文件中相关的 &lt;script&gt; 标签是否正确。</p>' +
                '</div>';
        }
    }

})();