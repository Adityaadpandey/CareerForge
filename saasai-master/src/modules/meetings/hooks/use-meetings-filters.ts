import { DEFAULT_PAGE } from "@/constants";
import { stat } from "fs";
import {parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates} from "nuqs";
import { MeetingStatus } from "../types";

export const useMeetingsFilters = () => {
    return useQueryStates({
        search: parseAsString.withDefault("").withOptions({ clearOnDefault: true}),
        page: parseAsInteger.withDefault(DEFAULT_PAGE).withOptions({ clearOnDefault: true}),
        status: parseAsStringEnum(Object.values(MeetingStatus)),
        agnetId: parseAsString.withDefault("").withOptions({ clearOnDefault: true}),
    });
};