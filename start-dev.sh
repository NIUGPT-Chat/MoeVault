#!/bin/bash

# 检查是否安装了所需依赖
check_dependencies() {
    echo "检查依赖..."
    if ! command -v node &> /dev/null; then
        echo "未安装 Node.js，请先安装 Node.js"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "未安装 npm，请先安装 npm"
        exit 1
    fi
}

# 安装项目依赖
install_dependencies() {
    echo "安装项目依赖..."
    npm install
}

# 启动开发服务器
start_dev_server() {
    echo "启动开发服务器..."
    npm run dev
}

# 主函数
main() {
    echo "=== MoeVault 开发环境启动脚本 ==="
    
    check_dependencies
    install_dependencies
    start_dev_server
}

# 运行主函数
main 