#!/usr/bin/env bun

/**
 * AI玩家服务器状态检查工具
 * 用于诊断服务器启动问题
 */

async function checkPlayerServers() {
  console.log('🔍 检查AI玩家服务器状态...\n');

  const ports = [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008];
  
  for (const port of ports) {
    console.log(`📡 检查端口 ${port}:`);
    
    try {
      // 检查端口是否有服务运行
      const response = await fetch(`http://localhost:${port}/api/player/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ 端口 ${port} - 服务正常运行`);
        console.log(`   📊 状态:`, JSON.stringify(data, null, 4));
      } else {
        console.log(`   ⚠️ 端口 ${port} - 服务响应异常: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`   错误详情: ${errorText}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        console.log(`   ⏰ 端口 ${port} - 请求超时`);
      } else if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        console.log(`   ❌ 端口 ${port} - 连接被拒绝 (服务器未启动)`);
      } else {
        console.log(`   ❌ 端口 ${port} - 连接失败:`, error.message);
      }
    }
    
    console.log('');
  }
  
  console.log('🏁 检查完成\n');
  
  console.log('💡 建议:');
  console.log('   如果所有端口都显示连接被拒绝，请运行: bun run dev:players');
  console.log('   如果部分端口正常，检查启动脚本是否完整执行');
  console.log('   如果端口冲突，检查是否有其他程序占用端口');
}

checkPlayerServers().catch(console.error);