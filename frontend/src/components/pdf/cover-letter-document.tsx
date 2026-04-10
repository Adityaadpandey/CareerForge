import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CoverLetterData } from "./types";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10.5,
    color: "#374151",
    paddingHorizontal: 50,
    paddingVertical: 45,
    backgroundColor: "#FFFFFF",
  },
  name: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  contact: { fontSize: 9, color: "#6B7280", marginBottom: 10 },
  rule: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#F59E0B",
    marginBottom: 20,
  },
  date: { fontSize: 9, color: "#6B7280", marginBottom: 16 },
  greeting: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    marginBottom: 14,
  },
  paragraph: {
    fontSize: 10.5,
    color: "#374151",
    lineHeight: 1.6,
    marginBottom: 12,
  },
  closing: {
    fontSize: 10.5,
    color: "#374151",
    marginTop: 8,
    marginBottom: 24,
  },
  sigName: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
});

export function CoverLetterDocument({ data }: { data: CoverLetterData }) {
  const contact = [data.email, data.phone].filter(Boolean).join("  ·  ");
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <Text style={S.name}>{data.name}</Text>
        <Text style={S.contact}>{contact}</Text>
        <View style={S.rule} />
        <Text style={S.date}>{today}</Text>
        <Text style={S.greeting}>{data.greeting}</Text>
        {data.paragraphs.map((p, i) => (
          <Text key={i} style={S.paragraph}>{p}</Text>
        ))}
        <Text style={S.closing}>{data.closing}</Text>
        <Text style={S.sigName}>{data.name}</Text>
      </Page>
    </Document>
  );
}
