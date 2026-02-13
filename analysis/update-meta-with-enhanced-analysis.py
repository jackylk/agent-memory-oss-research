#!/usr/bin/env python3
"""
更新项目的 meta.json，添加增强的云服务需求分析数据
从 enhanced-cloud-analysis.json 提取关键数据并合并到 meta.json
"""

import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / 'data' / 'projects'

def update_project_meta(project_name: str):
    """更新单个项目的 meta.json"""
    project_dir = DATA_DIR / project_name
    enhanced_file = project_dir / 'enhanced-cloud-analysis.json'
    meta_file = project_dir / 'meta.json'

    if not enhanced_file.exists():
        print(f"⚠️  {project_name}: enhanced-cloud-analysis.json 不存在")
        return False

    if not meta_file.exists():
        print(f"⚠️  {project_name}: meta.json 不存在")
        return False

    # 读取增强分析
    with open(enhanced_file, 'r', encoding='utf-8') as f:
        enhanced = json.load(f)

    # 读取现有 meta
    with open(meta_file, 'r', encoding='utf-8') as f:
        meta = json.load(f)

    # 更新 cloud_needs 字段（保留现有的简化版本，添加详细数据）
    if 'cloud_needs' not in meta:
        meta['cloud_needs'] = {}

    # 添加详细的存储分析
    meta['cloud_needs']['storage_detail'] = {
        'vector_storage': enhanced.get('storage', {}).get('vector_storage', {}),
        'primary_database': enhanced.get('storage', {}).get('primary_database', {}),
        'graph_database': enhanced.get('storage', {}).get('graph_database', {}),
        'cache': enhanced.get('storage', {}).get('cache', {}),
        'data_scale': enhanced.get('storage', {}).get('data_scale', {}),
        'performance': enhanced.get('storage', {}).get('performance', {}),
    }

    # 添加详细的计算分析
    meta['cloud_needs']['compute_detail'] = {
        'cpu': enhanced.get('compute', {}).get('cpu', {}),
        'memory': enhanced.get('compute', {}).get('memory', {}),
        'gpu': enhanced.get('compute', {}).get('gpu', {}),
        'scalability': enhanced.get('compute', {}).get('scalability', {}),
        'serverless': enhanced.get('compute', {}).get('serverless', {}),
        'concurrency': enhanced.get('compute', {}).get('concurrency', {}),
    }

    # 🔥 添加昇腾NPU兼容性分析
    meta['cloud_needs']['ascend_npu'] = enhanced.get('compute', {}).get('ascend_npu', {})

    # 添加外部服务依赖
    meta['cloud_needs']['external_services'] = enhanced.get('external_services', {})

    # 添加部署详情
    meta['cloud_needs']['deployment_detail'] = enhanced.get('deployment', {})

    # 🔥 添加华为云适配性分析
    meta['huawei_cloud'] = enhanced.get('huawei_cloud', {})

    # 保存更新后的 meta.json
    with open(meta_file, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # 统计信息
    npu_compat = meta['cloud_needs']['ascend_npu'].get('compatibility_level', '未知')
    hw_difficulty = meta['huawei_cloud'].get('overall_difficulty', '未知')
    gpu_required = '是' if meta['cloud_needs']['compute_detail']['gpu'].get('required') else '否'

    print(f"✓ {project_name:20s} GPU:{gpu_required:2s} NPU:{npu_compat:15s} 华为云:{hw_difficulty}")
    return True

def main():
    # 已完成分析的项目列表
    completed_projects = [
        'mem0', 'letta', 'hindsight',  # 试点
        'A-MEM', 'graphiti', 'cognee', 'supermemory', 'MemOS',  # 批次1
        'Memary', 'beads', 'claude-mem', 'easymemory', 'LightMem',  # 批次2
    ]

    print("📊 开始更新项目的 meta.json...\n")
    print(f"{'项目名称':20s} GPU  NPU兼容性       华为云难度")
    print("-" * 60)

    success_count = 0
    for project in completed_projects:
        if update_project_meta(project):
            success_count += 1

    print("-" * 60)
    print(f"\n✅ 成功更新 {success_count}/{len(completed_projects)} 个项目")

if __name__ == '__main__':
    main()
