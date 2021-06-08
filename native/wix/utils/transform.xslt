<?xml version="1.0" encoding="utf-8" ?>

<!-- Transformation file for Heat to automatically detect and use Win64 attribute -->
<!-- File is based on StackOverflow answer by taffit: https://stackoverflow.com/a/23012315/6523409 -->

<xsl:stylesheet
    version="1.0"
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
    xmlns:wix="http://schemas.microsoft.com/wix/2006/wi"
    xmlns="http://schemas.microsoft.com/wix/2006/wi"
    exclude-result-prefixes="wix"
>
    <xsl:output method="xml" encoding="utf-8" indent="yes" />

    <xsl:template match="wix:Wix">
        <xsl:copy>
            <!-- Include configuration preprocessor for detecting current platform -->
            <xsl:processing-instruction name="include">utils\config.wxi</xsl:processing-instruction>
            <xsl:apply-templates select="@*" />
            <xsl:apply-templates />
        </xsl:copy>
    </xsl:template>

    <xsl:template match="wix:Component">
        <xsl:copy>
            <!-- Select attributes of the tag -->
            <xsl:apply-templates select="@*" />

            <!-- Add the Win64 attribute based on variable from preprocessor -->
            <xsl:attribute name="Win64">$(var.Win64)</xsl:attribute>

            <!-- Now take the rest of the inner tag -->
            <xsl:apply-templates select="node()" />
        </xsl:copy>
    </xsl:template>

    <xsl:template match="@*|node()">
        <xsl:copy>
            <xsl:apply-templates select="@*|node()" />
        </xsl:copy>
    </xsl:template>
</xsl:stylesheet>
