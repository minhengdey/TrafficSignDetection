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

    public RoboflowService(TrafficSignTypeRepository repo) {
        this.repo = repo;
    }

    /**
     * Gọi Roboflow API để lấy danh sách classes (tên).
     * Trả về danh sách tên class (String).
     */
    public List<String> fetchRoboflowClasses() throws Exception {
        // Build URL: support two formats for project identifier:
        // 1) if ROBOFLOW_MODEL already contains workspace/project (e.g.
        // "myworkspace/myproject"), use it directly
        // 2) else if ROBOFLOW_WORKSPACE is configured, use workspace + project
        // 3) otherwise fall back to using project id as-is (may result in 404 if
        // missing workspace)
        String projectPath;
        if (ROBOFLOW_MODEL != null && ROBOFLOW_MODEL.contains("/")) {
            projectPath = ROBOFLOW_MODEL;
        } else if (ROBOFLOW_WORKSPACE != null && !ROBOFLOW_WORKSPACE.isBlank()) {
            projectPath = ROBOFLOW_WORKSPACE + "/" + ROBOFLOW_MODEL;
        } else {
            projectPath = ROBOFLOW_MODEL; // best-effort; may fail if workspace is required
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

        // fallback: try to inspect root for property names
        Iterator<String> fieldNames = root.fieldNames();
        List<String> names = new ArrayList<>();
        while (fieldNames.hasNext()) {
            names.add(fieldNames.next());
        }
        // If nothing found, return empty list
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
                    // try all text fields
                    Optional<String> t = streamFieldTextValues(it).stream().findFirst();
                    t.ifPresent(result::add);
                }
            }
        } else if (node.isObject()) {
            // object of { className: count } -> keys are labels
            node.fieldNames().forEachRemaining(result::add);
        }
        // trim and unique
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

    /**
     * Insert các class vào DB (bỏ example_image_path).
     * Nếu code đã tồn tại -> bỏ qua.
     */
    public List<TrafficSignType> importClassesToDb() throws Exception {
        List<String> classes = fetchRoboflowClasses();

        List<TrafficSignType> saved = new ArrayList<>();
        for (String cls : classes) {
            String code = normalizeCode(cls);
            String name = cls;
            String description = ""; // bạn có thể map mô tả nếu có nguồn khác

            // check tồn tại
            Optional<TrafficSignType> existing = repo.findByCode(code);
            if (existing.isPresent()) {
                saved.add(existing.get());
                continue;
            }
            TrafficSignType item = new TrafficSignType(code, name, description);
            saved.add(repo.save(item));
        }
        return saved;
    }

    private String normalizeCode(String raw) {
        if (raw == null)
            return null;
        String code = raw.trim();
        // basic sanitization: uppercase, replace spaces and slashes with underscores,
        // remove non-alphanum except _
        code = code.replaceAll("[\\s/\\\\]+", "_");
        code = code.replaceAll("[^A-Za-z0-9_\\-]", "");
        return code.length() > 100 ? code.substring(0, 100) : code;
    }
}
