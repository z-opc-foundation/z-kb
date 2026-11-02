/**
 * z-kb 协议层 —— REST 接口的数据契约。
 *
 * <p>本包只放**跨模块共享的传输对象**：请求体、响应体、以及错误信封。
 * 领域模型（{@code com.zifang.z.kb.api.*}）归 api 模块，运行时编排归各实现模块，
 * 这里一概不放 —— 协议层一旦渗进领域逻辑，就会被业务实现反向污染。
 *
 * <p>划分依据是"原先用裸 {@code Map<String,Object>} 收发的那几条边"。
 * 裸 Map 的代价是：Knife4j 文档里只剩 {@code object}，字段名写错要到运行时才发现，
 * 前端也无法据此生成类型。换成具名 DTO 后，这几条边的契约在编译期就钉住了。
 *
 * <p>刻意不收进来的：
 * <ul>
 *   <li>{@code IngestController#run} 的 {@code config} —— 它是透传给各数据源的自由参数，
 *       形状由每个 source 自己决定，强行建模只会挡住新接入。</li>
 *   <li>{@code IngestPipeline.Stats} —— 它是流水线内部状态的直接投影，字段全是 {@code public final}，
 *       建模等于把实现细节抄一遍；它只出现在一个 GET 上，Swagger 读反射即可。</li>
 * </ul>
 */
package com.zifang.z.kb.protocol;
