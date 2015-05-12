varying vec3 worldSpaceCoords;
varying vec4 projectedCoords;

uniform sampler2D firstPassTexture, dataTexture; //i.e. tex and cubeTex
uniform vec3 lightPosition;
uniform vec3 lightColor;
uniform float lightIntensity;
uniform float steps;
uniform float alphaCorrection;

uniform vec3 dataShape;
uniform vec2 textureShape;

struct Light {
    vec3 position;
    vec3 color;
    float intensity;
};

Light light = Light(lightPosition,
                    lightColor,
                    lightIntensity);

const int MAX_STEPS = 81;

vec3 toLocal(vec3 p) {
    // changes from clip coords (-0.5 -> 0.5) to local coords(0->1)
    return p + vec3(0.5);
}

vec3 getDatumColor(float datum) {
    vec3 color = vec3(1, 1, 1);
    if (datum == 9999.9999){ // for debugging
        color = vec3(1, 0, 0);
    }
    return color;
}

float getDatumAlpha(float datum) {
    return datum * alphaCorrection;
}

float getDatum(sampler2D tex, vec3 pos, vec3 dataShape, vec2 nTiles, float tilesPerLayer, vec2 tileDim, float thisTileN){
    float zTile = floor(thisTileN/tilesPerLayer);
    float yTile = floor((thisTileN - (zTile * tilesPerLayer)) / nTiles.x);
    float xTile = mod((thisTileN - (zTile * tilesPerLayer)), nTiles.x);
    
    vec2 thisPoint = vec2(xTile+pos.x, yTile+pos.y) * tileDim;

    vec4 datumRGB = texture2D(tex, thisPoint);
    float datum;
    if (zTile == 0.0){
        datum = datumRGB.r;
    }else if (zTile == 1.0){
        datum = datumRGB.g;
    }else if (zTile == 2.0){
        datum = datumRGB.b;
    }

    return datum;
}

float sampleAs3DTexture(sampler2D tex, vec3 pos, vec3 dataShape, vec2 texShape) {
    /* 
    A function to reference a 2D RGBA texture which contains tiles 3D array data.

    Tiling goes column, row, channel

    Args:
        * tex: texture of tiled data
        * pos: position of the datum
        * dataShape: the x,y,z shape of the data which has been tiled
        * texShape: the x,y dims of the tiles texture
    */

    vec2 fracNTiles = texShape.xy / dataShape.xy;
    vec2 nTiles = vec2(floor(fracNTiles.x), floor(fracNTiles.y));
    float tilesPerLayer = nTiles.x * nTiles.y;
    vec2 tileDim = vec2(1.0, 1.0) / fracNTiles;
    float thisTileN = floor((dataShape.z-1.0) * pos.z);
    float thisTileNp1 = min(thisTileN+1.0, dataShape.z);

    float datumN = getDatum(tex, pos, dataShape, nTiles, tilesPerLayer, tileDim, thisTileN);
    float datumNp1 = getDatum(tex, pos, dataShape, nTiles, tilesPerLayer, tileDim, thisTileNp1);

    float zDiff = mod((dataShape.z-1.0) * pos.z, 1.0);

    return ((1.0 - zDiff) * datumN) + (zDiff * datumNp1);
}

vec4 getRGBAfromDataTex(sampler2D tex, vec3 pos, vec3 dataShape, vec2 texShape){
    // pos.xyz = clamp(pos.xyz, 0.01,0.99);
    float datum = sampleAs3DTexture(tex, pos, dataShape, texShape);
    vec3 color = getDatumColor(datum);
    float alpha = getDatumAlpha(datum);

    return vec4(color.xyz, alpha);
}

vec4 getPathRGBA(vec3 startPos, vec3 endPos, float steps, sampler2D tex){
    /* Calculates the total RGBA values of a given path through a texture */

    //The direction from the front position to back position.
    vec3 dir = endPos - startPos;

    float rayLength = length(dir);

    //Calculate how long to increment in each step.
    float delta = 1.0 / steps;

    //The increment in each direction for each step.
    vec3 deltaDirection = normalize(dir) * delta;
    float deltaDirectionLength = length(deltaDirection);

    vec3 currentPosition = startPos;

    //The color accumulator.
    vec3 accumulatedColor = vec3(0.0);

    //The alpha value accumulated so far.
    float accumulatedAlpha = 0.0;

    //How long has the ray travelled so far.
    float accumulatedLength = 0.0;

    //vec4 dataSample;
    vec4 dataSample;

    float alphaSample;

    //Perform the ray marching iterations
    for(int i = 0; i < MAX_STEPS; i++){
        //Get the voxel intensity value from the 3D texture.    
        dataSample = getRGBAfromDataTex(dataTexture, currentPosition, dataShape, textureShape);

        //Perform the composition.
        accumulatedColor += (1.0 - accumulatedAlpha) * dataSample.xyz * dataSample.a;
        //accumulatedColor += dataSample;

        //Store the alpha accumulated so far.
        accumulatedAlpha += dataSample.a;
    
        //Advance the ray.
        currentPosition += deltaDirection;
        accumulatedLength += deltaDirectionLength;
                  
        //If the length traversed is more than the ray length, or if the alpha accumulated reaches 1.0 then exit.
        if(accumulatedLength >= rayLength || accumulatedAlpha >= 1.0 ){
            break;
        }
    }

    if (accumulatedAlpha >= 1.0) {
        accumulatedAlpha = 1.0;
    }

    return vec4(accumulatedColor.r, accumulatedColor.g, accumulatedColor.b, accumulatedAlpha);
}

vec4 getPathRGBAwithLight(vec3 startPos, vec3 endPos, float steps, sampler2D tex, Light light){
    /* Calculates the total RGBA values of a given path through a texture */

    //The direction from the front position to back position.
    vec3 dir = endPos - startPos;

    float rayLength = length(dir);

    //Calculate how long to increment in each step.
    float delta = 1.0 / steps;

    //The increment in each direction for each step.
    vec3 deltaDirection = normalize(dir) * delta;
    float deltaDirectionLength = length(deltaDirection);

    vec3 currentPosition = startPos;

    //The color accumulator.
    vec3 accumulatedColor = vec3(0.0);

    //The alpha value accumulated so far.
    float accumulatedAlpha = 0.0;

    //How long has the ray travelled so far.
    float accumulatedLength = 0.0;

    //vec4 dataSample;
    vec4 dataRGBA;
    vec4 lightRayRGBA;
    vec3 apparentRGB;
    vec4 lightRayPathRGBA;

    //Perform the ray marching iterations
    for(int i = 0; i < MAX_STEPS; i++){
        //Get the voxel intensity value from the 3D texture.    
        dataRGBA = getRGBAfromDataTex(dataTexture, currentPosition, dataShape, textureShape);

        // get contribution from the light
        lightRayPathRGBA = getPathRGBA(currentPosition, light.position, steps, tex); // this is the light absorbed so we need to take 1.0- to get the light transmitted
        lightRayRGBA = (vec4(1.0) - lightRayPathRGBA) * vec4(light.color, light.intensity);

        apparentRGB = (1.0 - accumulatedAlpha) * dataRGBA.rgb * lightRayRGBA.rgb * dataRGBA.a * lightRayRGBA.a;
        //apparentRGB = (1.0 - accumulatedAlpha) * dataRGBA.rgb * dataRGBA.a * lightRayRGBA.a;

        //Perform the composition.
        accumulatedColor += apparentRGB;
        //Store the alpha accumulated so far.
        accumulatedAlpha += dataRGBA.a;

        //Adva      nce the ray.
        currentPosition += deltaDirection;
        accumulatedLength += deltaDirectionLength;
                  
        //If the length traversed is more than the ray length, or if the alpha accumulated reaches 1.0 then exit.
        if(accumulatedLength >= rayLength || accumulatedAlpha >= 1.0 ){
            break;
        }
    }

    return vec4(accumulatedColor.xyz, accumulatedAlpha);
}


// max 2d size is 4096 x 4096

void main( void ) {
    //Transform the coordinates it from [-1;1] to [0;1]
    vec2 firstPassTexCoord = vec2(((projectedCoords.x / projectedCoords.w) + 1.0 ) / 2.0,
                    ((projectedCoords.y / projectedCoords.w) + 1.0 ) / 2.0 );

    //The back position is the world space position stored in the texture.
    vec3 backPos = texture2D(firstPassTexture, firstPassTexCoord).xyz;

    //The front position is the world space position of the second render pass.
    vec3 frontPos = worldSpaceCoords;

    // cast ray from front position in direction of back position
    gl_FragColor = getPathRGBAwithLight(frontPos, backPos, steps, dataTexture, light);
    //gl_FragColor = getPathRGBA(frontPos, backPos, steps, dataTexture);
}