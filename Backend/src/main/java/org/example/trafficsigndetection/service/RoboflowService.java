package org.example.trafficsigndetection.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.example.trafficsigndetection.entity.TrafficSignType;
import org.example.trafficsigndetection.repository.TrafficSignTypeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RoboflowService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();
    private final TrafficSignTypeRepository repo;

    @Value("${roboflow.api.key:}")
    private String ROBOFLOW_API_KEY;

    @Value("${roboflow.project-slug}")
    private String ROBOFLOW_MODEL;

    @Value("${roboflow.workspace:}")
    private String ROBOFLOW_WORKSPACE;

    @Value("${roboflow.model.version}")
    private String ROBOFLOW_VERSION;

    private static final Map<String, SignData> SIGN_DATA_MAP = new LinkedHashMap<>();

    static {
        SIGN_DATA_MAP.put("warn_speed_bumper", new SignData(1, "Gờ giảm tốc", "Speed Bump Warning", "Cảnh báo: Phía trước có gờ giảm tốc."));
        SIGN_DATA_MAP.put("warn_two_way_traffic", new SignData(2, "Đường hai chiều", "Two-way Traffic", "Cảnh báo: Phía trước là đường hai chiều."));
        SIGN_DATA_MAP.put("forb_overtake", new SignData(3, "Cấm vượt", "No Overtaking", "Cấm vượt phương tiện khác."));
        SIGN_DATA_MAP.put("warn_tram", new SignData(4, "Đường tàu điện", "Tramway Crossing", "Cảnh báo: Phía trước có đường tàu điện."));
        SIGN_DATA_MAP.put("warn_construction", new SignData(5, "Đường đang thi công", "Road Work", "Cảnh báo: Đường đang thi công, đi chậm."));
        SIGN_DATA_MAP.put("mand_right", new SignData(6, "Rẽ phải bắt buộc", "Turn Right Mandatory", "Yêu cầu: Phải rẽ phải."));
        SIGN_DATA_MAP.put("mand_pass_left_right", new SignData(7, "Đi vòng trái hoặc phải", "Pass Left or Right", "Yêu cầu: Đi vòng sang bên trái hoặc bên phải."));
        SIGN_DATA_MAP.put("forb_speed_over_60", new SignData(8, "Cấm tốc độ trên 60 km/h", "Speed Limit 60", "Cấm chạy quá 60 km/giờ."));
        SIGN_DATA_MAP.put("mand_pass_left", new SignData(9, "Đi vòng bên trái", "Pass Left", "Yêu cầu: Đi vòng sang bên trái chướng ngại vật."));
        SIGN_DATA_MAP.put("forb_speed_over_20", new SignData(10, "Cấm tốc độ trên 20 km/h", "Speed Limit 20", "Cấm chạy quá 20 km/giờ."));
        SIGN_DATA_MAP.put("warn_poor_road_surface", new SignData(11, "Đường xấu", "Uneven Road", "Cảnh báo: Mặt đường gồ ghề, xấu."));
        SIGN_DATA_MAP.put("mand_left", new SignData(12, "Rẽ trái bắt buộc", "Turn Left Mandatory", "Yêu cầu: Phải rẽ trái."));
        SIGN_DATA_MAP.put("warn_crosswalk", new SignData(13, "Lối đi bộ", "Pedestrian Crossing", "Cảnh báo: Có người đi bộ qua đường."));
        SIGN_DATA_MAP.put("warn_domestic_animals", new SignData(14, "Gia súc qua đường", "Domestic Animals Crossing", "Cảnh báo: Gia súc băng qua đường."));
        SIGN_DATA_MAP.put("warn_other_dangers", new SignData(15, "Nguy hiểm khác", "Other Dangers", "Cảnh báo: Nguy hiểm khác phía trước."));
        SIGN_DATA_MAP.put("mand_straight_right", new SignData(16, "Đi thẳng hoặc rẽ phải", "Straight or Right", "Yêu cầu: Đi thẳng hoặc rẽ phải."));
        SIGN_DATA_MAP.put("forb_speed_over_100", new SignData(17, "Cấm tốc độ trên 100 km/h", "Speed Limit 100", "Cấm chạy quá 100 km/giờ."));
        SIGN_DATA_MAP.put("mand_straight", new SignData(18, "Đi thẳng bắt buộc", "Go Straight", "Yêu cầu: Phải đi thẳng."));
        SIGN_DATA_MAP.put("mand_roundabout", new SignData(19, "Vào vòng xuyến", "Enter Roundabout", "Yêu cầu: Vào vòng xuyến."));
        SIGN_DATA_MAP.put("forb_speed_over_5", new SignData(20, "Cấm tốc độ trên 5 km/h", "Speed Limit 5", "Cấm chạy quá 5 km/giờ."));
        SIGN_DATA_MAP.put("forb_speed_over_70", new SignData(21, "Cấm tốc độ trên 70 km/h", "Speed Limit 70", "Cấm chạy quá 70 km/giờ."));
        SIGN_DATA_MAP.put("forb_trucks", new SignData(22, "Cấm xe tải", "No Trucks", "Cấm xe tải lưu thông."));
        SIGN_DATA_MAP.put("info_one_way_traffic", new SignData(23, "Đường một chiều", "One Way", "Đường một chiều, đi đúng hướng."));
        SIGN_DATA_MAP.put("forb_speed_over_30", new SignData(24, "Cấm tốc độ trên 30 km/h", "Speed Limit 30", "Cấm chạy quá 30 km/giờ."));
        SIGN_DATA_MAP.put("mand_pass_right", new SignData(25, "Đi vòng bên phải", "Pass Right", "Yêu cầu: Đi vòng sang bên phải chướng ngại vật."));
        SIGN_DATA_MAP.put("forb_ahead", new SignData(26, "Cấm đi thẳng", "No Straight Ahead", "Cấm đi thẳng."));
        SIGN_DATA_MAP.put("prio_stop", new SignData(27, "Dừng lại", "Stop", "Dừng lại và quan sát trước khi đi tiếp."));
        SIGN_DATA_MAP.put("info_highway", new SignData(28, "Đường cao tốc", "Highway", "Đường cao tốc, chú ý tốc độ và làn đường."));
        SIGN_DATA_MAP.put("mand_straigh_left", new SignData(29, "Đi thẳng hoặc rẽ trái", "Straight or Left", "Yêu cầu: Đi thẳng hoặc rẽ trái."));
        SIGN_DATA_MAP.put("forb_speed_over_130", new SignData(30, "Cấm tốc độ trên 130 km/h", "Speed Limit 130", "Cấm chạy quá 130 km/giờ."));
        SIGN_DATA_MAP.put("forb_speed_over_80", new SignData(31, "Cấm tốc độ trên 80 km/h", "Speed Limit 80", "Cấm chạy quá 80 km/giờ."));
        SIGN_DATA_MAP.put("forb_left", new SignData(32, "Cấm rẽ trái", "No Left Turn", "Cấm rẽ trái."));
        SIGN_DATA_MAP.put("forb_speed_over_40", new SignData(33, "Cấm tốc độ trên 40 km/h", "Speed Limit 40", "Cấm chạy quá 40 km/giờ."));
        SIGN_DATA_MAP.put("mand_bike_lane", new SignData(34, "Làn xe đạp", "Bike Lane", "Làn đường dành riêng cho xe đạp."));
        SIGN_DATA_MAP.put("warn_cyclists", new SignData(35, "Cảnh báo xe đạp", "Cyclists Ahead", "Cảnh báo: Có người đi xe đạp phía trước."));
        SIGN_DATA_MAP.put("warn_traffic_light", new SignData(36, "Cảnh báo đèn giao thông", "Traffic Light Ahead", "Cảnh báo: Phía trước có đèn giao thông."));
        SIGN_DATA_MAP.put("prio_give_way", new SignData(37, "Nhường đường", "Give Way", "Yêu cầu: Nhường đường cho xe khác."));
        SIGN_DATA_MAP.put("forb_u_turn", new SignData(38, "Cấm quay đầu", "No U-turn", "Cấm quay đầu xe."));
        SIGN_DATA_MAP.put("forb_stopping", new SignData(39, "Cấm dừng xe", "No Stopping", "Cấm dừng xe tại đây."));
        SIGN_DATA_MAP.put("forb_weight_over_75t", new SignData(40, "Cấm xe trên 7.5 tấn", "No Vehicles Over 7.5 Tons", "Cấm xe có tải trọng trên 7,5 tấn."));
        SIGN_DATA_MAP.put("forb_weight_over_35t", new SignData(41, "Cấm xe trên 3.5 tấn", "No Vehicles Over 3.5 Tons", "Cấm xe có tải trọng trên 3,5 tấn."));
        SIGN_DATA_MAP.put("mand_left_right", new SignData(42, "Rẽ trái hoặc phải", "Turn Left or Right", "Yêu cầu: Rẽ trái hoặc phải."));
        SIGN_DATA_MAP.put("prio_priority_road", new SignData(43, "Đường ưu tiên", "Priority Road", "Đường ưu tiên, xe trên đường này được quyền đi trước."));
        SIGN_DATA_MAP.put("warn_slippery_road", new SignData(44, "Đường trơn trượt", "Slippery Road", "Cảnh báo: Đường trơn trượt, giảm tốc độ."));
        SIGN_DATA_MAP.put("info_bus_station", new SignData(45, "Trạm xe buýt", "Bus Stop", "Phía trước có trạm xe buýt."));
        SIGN_DATA_MAP.put("info_crosswalk", new SignData(46, "Khu vực đi bộ", "Pedestrian Area", "Khu vực dành cho người đi bộ."));
        SIGN_DATA_MAP.put("warn_wild_animals", new SignData(47, "Động vật hoang dã", "Wild Animals Crossing", "Cảnh báo: Có động vật hoang dã qua đường."));
        SIGN_DATA_MAP.put("warn_roundabout", new SignData(48, "Cảnh báo vòng xuyến", "Roundabout Ahead", "Cảnh báo: Sắp tới vòng xuyến."));
        SIGN_DATA_MAP.put("forb_speed_over_90", new SignData(49, "Cấm tốc độ trên 90 km/h", "Speed Limit 90", "Cấm chạy quá 90 km/giờ."));
        SIGN_DATA_MAP.put("info_taxi_parking", new SignData(50, "Bãi đỗ taxi", "Taxi Parking", "Khu vực dành cho taxi đỗ."));
        SIGN_DATA_MAP.put("warn_children", new SignData(51, "Khu vực có trẻ em", "Children Crossing", "Cảnh báo: Khu vực có trẻ em."));
        SIGN_DATA_MAP.put("forb_speed_over_50", new SignData(52, "Cấm tốc độ trên 50 km/h", "Speed Limit 50", "Cấm chạy quá 50 km/giờ."));
        SIGN_DATA_MAP.put("forb_right", new SignData(53, "Cấm rẽ phải", "No Right Turn", "Cấm rẽ phải."));
        SIGN_DATA_MAP.put("forb_speed_over_10", new SignData(54, "Cấm tốc độ trên 10 km/h", "Speed Limit 10", "Cấm chạy quá 10 km/giờ."));
        SIGN_DATA_MAP.put("info_parking", new SignData(55, "Bãi đỗ xe", "Parking", "Khu vực đỗ xe."));
    }

    public RoboflowService(TrafficSignTypeRepository repo) {
        this.repo = repo;
    }

    public List<String> fetchRoboflowClasses() throws Exception {
        String projectPath;
        if (ROBOFLOW_MODEL != null && ROBOFLOW_MODEL.contains("/")) {
            projectPath = ROBOFLOW_MODEL;
        } else if (ROBOFLOW_WORKSPACE != null && !ROBOFLOW_WORKSPACE.isBlank()) {
            projectPath = ROBOFLOW_WORKSPACE + "/" + ROBOFLOW_MODEL;
        } else {
            projectPath = ROBOFLOW_MODEL;
        }

        String url = String.format("https://api.roboflow.com/%s/%s?api_key=%s",
                projectPath, ROBOFLOW_VERSION, ROBOFLOW_API_KEY);

        ResponseEntity<String> resp;
        try {
            resp = restTemplate.exchange(url, HttpMethod.GET, null, String.class);
        } catch (HttpClientErrorException he) {
            String body = he.getResponseBodyAsString();
            System.err.printf("Roboflow fetch classes failed: %s -> %s\n", he.getStatusCode(), body);
            return Collections.emptyList();
        }

        if (resp.getStatusCode() != HttpStatus.OK) {
            throw new IllegalStateException("Roboflow API returned status: " + resp.getStatusCode());
        }

        String body = resp.getBody();
        JsonNode root = mapper.readTree(body);

        List<JsonNode> candidateNodes = new ArrayList<>();
        candidateNodes.add(root.path("classes"));
        candidateNodes.add(root.path("project").path("classes"));
        candidateNodes.add(root.path("version").path("classes"));

        for (JsonNode node : candidateNodes) {
            if (node != null && !node.isMissingNode() && !node.isNull()) {
                List<String> parsed = parseClassesNode(node);
                if (!parsed.isEmpty())
                    return parsed;
            }
        }

        Iterator<String> fieldNames = root.fieldNames();
        List<String> names = new ArrayList<>();
        while (fieldNames.hasNext()) {
            names.add(fieldNames.next());
        }
        return Collections.emptyList();
    }

    private List<String> parseClassesNode(JsonNode node) {
        List<String> result = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode it : node) {
                if (it.isTextual()) {
                    result.add(it.asText());
                } else if (it.has("name")) {
                    result.add(it.get("name").asText());
                } else if (it.has("class")) {
                    result.add(it.get("class").asText());
                } else {
                    Optional<String> t = streamFieldTextValues(it).stream().findFirst();
                    t.ifPresent(result::add);
                }
            }
        } else if (node.isObject()) {
            node.fieldNames().forEachRemaining(result::add);
        }
        return result.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .collect(Collectors.toList());
    }

    private List<String> streamFieldTextValues(JsonNode node) {
        List<String> res = new ArrayList<>();
        node.fieldNames().forEachRemaining(fn -> {
            JsonNode v = node.get(fn);
            if (v.isTextual())
                res.add(v.asText());
        });
        return res;
    }

    public List<TrafficSignType> importClassesToDb() throws Exception {
        List<String> classes = fetchRoboflowClasses();

        List<TrafficSignType> saved = new ArrayList<>();
        for (String cls : classes) {
            String code = normalizeCode(cls);

            SignData signData = SIGN_DATA_MAP.get(code);
            if (signData == null) {
                signData = new SignData(null, cls, cls, "");
            }

            Optional<TrafficSignType> existing = repo.findByCode(code);
            if (existing.isPresent()) {
                saved.add(existing.get());
                continue;
            }

            TrafficSignType item = new TrafficSignType();
            if (signData.id != null) {
                item.setId(signData.id);
            }
            item.setCode(code);
            item.setName_vi(signData.nameVi);
            item.setName_en(signData.nameEn);
            item.setDescription(signData.description);

            saved.add(repo.save(item));
        }
        return saved;
    }

    private String normalizeCode(String raw) {
        if (raw == null)
            return null;
        String code = raw.trim();
        code = code.replaceAll("[\\s/\\\\]+", "_");
        code = code.replaceAll("[^A-Za-z0-9_\\-]", "");
        return code.length() > 100 ? code.substring(0, 100) : code;
    }

    private static class SignData {
        Integer id;
        String nameVi;
        String nameEn;
        String description;

        SignData(Integer id, String nameVi, String nameEn, String description) {
            this.id = id;
            this.nameVi = nameVi;
            this.nameEn = nameEn;
            this.description = description;
        }
    }
}