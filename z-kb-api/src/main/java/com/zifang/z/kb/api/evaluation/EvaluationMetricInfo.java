package com.zifang.z.kb.api.evaluation;

import java.math.BigDecimal;

/**
 * 单条评测指标，含基线值与增量。
 */
public class EvaluationMetricInfo {

    private String metricCode;
    private String metricName;
    private String metricLayer;
    private String stageCode;
    private BigDecimal value;
    private String unit;
    private BigDecimal targetValue;
    private String status;
    private Integer sampleSize;
    private String attribution;
    private String note;
    private BigDecimal baselineValue;
    private BigDecimal delta;

    public String getMetricCode() {
        return metricCode;
    }

    public void setMetricCode(String metricCode) {
        this.metricCode = metricCode;
    }

    public String getMetricName() {
        return metricName;
    }

    public void setMetricName(String metricName) {
        this.metricName = metricName;
    }

    public String getMetricLayer() {
        return metricLayer;
    }

    public void setMetricLayer(String metricLayer) {
        this.metricLayer = metricLayer;
    }

    public String getStageCode() {
        return stageCode;
    }

    public void setStageCode(String stageCode) {
        this.stageCode = stageCode;
    }

    public BigDecimal getValue() {
        return value;
    }

    public void setValue(BigDecimal value) {
        this.value = value;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public BigDecimal getTargetValue() {
        return targetValue;
    }

    public void setTargetValue(BigDecimal targetValue) {
        this.targetValue = targetValue;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getSampleSize() {
        return sampleSize;
    }

    public void setSampleSize(Integer sampleSize) {
        this.sampleSize = sampleSize;
    }

    public String getAttribution() {
        return attribution;
    }

    public void setAttribution(String attribution) {
        this.attribution = attribution;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public BigDecimal getBaselineValue() {
        return baselineValue;
    }

    public void setBaselineValue(BigDecimal baselineValue) {
        this.baselineValue = baselineValue;
    }

    public BigDecimal getDelta() {
        return delta;
    }

    public void setDelta(BigDecimal delta) {
        this.delta = delta;
    }
}
