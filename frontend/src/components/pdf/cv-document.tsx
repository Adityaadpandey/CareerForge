import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CvData } from "./types";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#374151",
    paddingHorizontal: 40,
    paddingVertical: 40,
    backgroundColor: "#FFFFFF",
  },
  name: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  contact: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 10,
  },
  rule: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#F59E0B",
    marginBottom: 14,
  },
  section: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#F59E0B",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    paddingLeft: 6,
    borderLeftWidth: 2,
    borderLeftColor: "#F59E0B",
  },
  summaryText: { fontSize: 10, color: "#374151", lineHeight: 1.5 },
  skillRow: { flexDirection: "row", marginBottom: 3 },
  skillCategory: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    width: 90,
  },
  skillList: { fontSize: 9, color: "#374151", flex: 1 },
  projectBlock: { marginBottom: 8 },
  projectHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  projectName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  projectTech: { fontSize: 9, color: "#6B7280" },
  bullet: {
    fontSize: 9.5,
    color: "#374151",
    lineHeight: 1.4,
    marginBottom: 2,
    paddingLeft: 10,
  },
  educationDegree: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  educationDetail: { fontSize: 9, color: "#6B7280" },
});

export function CVDocument({ data }: { data: CvData }) {
  const contact = [data.email, data.phone, data.linkedin, data.github]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <Text style={S.name}>{data.name}</Text>
        <Text style={S.contact}>{contact}</Text>
        <View style={S.rule} />

        {/* Summary */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>Summary</Text>
          <Text style={S.summaryText}>{data.summary}</Text>
        </View>

        {/* Skills */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>Skills</Text>
          {data.skills.languages.length > 0 && (
            <View style={S.skillRow}>
              <Text style={S.skillCategory}>Languages</Text>
              <Text style={S.skillList}>{data.skills.languages.join(", ")}</Text>
            </View>
          )}
          {data.skills.frameworks.length > 0 && (
            <View style={S.skillRow}>
              <Text style={S.skillCategory}>Frameworks</Text>
              <Text style={S.skillList}>{data.skills.frameworks.join(", ")}</Text>
            </View>
          )}
          {data.skills.tools.length > 0 && (
            <View style={S.skillRow}>
              <Text style={S.skillCategory}>Tools</Text>
              <Text style={S.skillList}>{data.skills.tools.join(", ")}</Text>
            </View>
          )}
        </View>

        {/* Projects */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>Projects</Text>
          {data.projects.map((project, i) => (
            <View key={i} style={S.projectBlock}>
              <View style={S.projectHeader}>
                <Text style={S.projectName}>{project.name}</Text>
                <Text style={S.projectTech}>{project.tech.join(" · ")}</Text>
              </View>
              {project.bullets.map((bullet, j) => (
                <Text key={j} style={S.bullet}>
                  {"• "}{bullet}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {/* Education */}
        <View style={S.section}>
          <Text style={S.sectionLabel}>Education</Text>
          <Text style={S.educationDegree}>{data.education.degree}</Text>
          <Text style={S.educationDetail}>
            {data.education.institution}{"  ·  Expected "}{data.education.year}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
